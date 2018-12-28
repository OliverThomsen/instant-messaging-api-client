import SocketIOClient from 'socket.io-client'

const _root = 'https://instant-messaging-api.herokuapp.com';
const _rootApi = `${_root}/api`;
const _headers =  {
	'Accept': 'application/json',
	'Content-Type': 'application/json'
};

let _io;
let _username;
let _userID;
let _events = {
	typing: [],
	typingEnd: [],
	message: [],
};


function _openSocket() {
	let typingCountdowns = {};

	_io = SocketIOClient(_root, {
		query: {
			userID: _userID,
		},
	});

	_io.on('message', (message) => {
		const chatID = message.chat.id;
		_emit('message', chatID, _addDirection(message));
	});

	_io.on('typing', (data) => {
		_emit('typing', data.chatID, data.username);

		if (! typingCountdowns[data.chatID]) {
			typingCountdowns[data.chatID] = {countingDown: false};
		}

		if (! typingCountdowns[data.chatID].countingDown) {
			typingCountdowns[data.chatID].countingDown = true;
			setTimeout(() => {
				_emit('typingEnd', data.chatID);
				typingCountdowns[data.chatID].countingDown = false;
			}, 3000);
		}
	});
}


function _emit(event, chatID, data) {
	_events[event].forEach(obj => {
		if (obj.chatID === chatID || ! obj.chatID) {
			obj.callback(data)
		}
	});
}


function _fetch(url, obj) {
	return fetch(url, obj)
		.then(_handleError)
		.then(res => res.json());
}


async function _handleError(res) {
	if (!res.ok) {
		res = await res.json();
		throw new Error(res.error)
	}
	return res;
}


function _addDirection(message) {
	const direction = (message.user.id === _userID) ? 'tx' : 'rx';
	return Object.assign(message, {direction});
}


function _sendMessage(content, chatID) {
	if (!chatID) return;
	_io.emit('message', { content, chatID })
}


function _sendTyping(chatID) {
	if (!chatID) return;
	_io.emit('typing', { chatID })
}


function _on(event, chatID, callback) {
	if (! _events[event]) return;
	if (chatID) {
		_events[event].push({chatID, callback});
	} else {
		_events[event].push({callback});
		console.log(_events);
	}

	return {
		unsubscribe: function() {
			_events[event] = _events[event].filter(obj => obj.callback !== callback)
		}
	}
}


function _unsubscribe(chatID, event) {
	if (! _events[event]) return;
	_events[event] = _events[event].filter(obj => obj.chatID !== chatID);
}


export function socket(chatID) {
	return {
		sendMessage(content) {
			_sendMessage(content, chatID);
		},

		sendTyping() {
			_sendTyping(chatID);
		},

		on(event, callback) {
			return _on(event, chatID, callback);
		},

		unsubscribe(event) {
			_unsubscribe(chatID, event)
		},
	};
}


export async function logIn(username) {
	const res = await _fetch(`${_rootApi}/login`, {
		method: 'POST',
		headers: _headers,
		body: JSON.stringify({username}),
	});

	_username = username;
	_userID = res.id;
	_openSocket();

	return res.id;
}


export function logOut() {
	_io.disconnect();
	_events.message = [];
	_events.typing = [];
	_username = undefined;
	_userID = undefined;
}


export async function signUp(username) {
	const res = await _fetch(`${_rootApi}/users`, {
		method: 'POST',
		headers: _headers,
		body: JSON.stringify({username}),
	});

	_username = username;
	_userID = res.id;
	_openSocket();
}


export function getChats() {
	return _fetch(`${_rootApi}/users/${_userID}/chats`)
}


export async function getMessages(chatID) {
	const messages = await _fetch(`${_rootApi}/chats/${chatID}/messages`);
	return messages.map(_addDirection);
}

export function createChat(usernames) {
	return _fetch(`${_rootApi}/chats`,{
		method: 'POST',
		headers: _headers,
		body: JSON.stringify({
			userID: _userID,
			usernames,
		}),
	})
}

export function searchUsers(username) {
	return _fetch(`${_rootApi}/users?username=${username}`)
}
