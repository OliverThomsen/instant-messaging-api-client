import SocketIOClient from 'socket.io-client'

const _root = 'http://localhost:3000';
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
		if (obj.chatID === chatID) {
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


export let socket = {
	sendMessage(content, chatID) {
		_io.emit('message', { content, chatID })
	},

	sendTyping(chatID) {
		_io.emit('typing', { chatID })
	},

	on(event, chatID, callback) {
		if (! _events[event]) return;
		_events[event].push({chatID, callback});
	},

	unsubscribe(chatID, event) {
		if (! _events[event]) return;
		_events[event] = _events[event].filter(obj => obj.chatID !== chatID);
	},
};


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
