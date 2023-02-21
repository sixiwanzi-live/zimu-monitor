import fetch from 'node-fetch';
import config from '../config.js';

export default class PushApi {

    static async push(title, content) {
        try {
            const url = `https://api2.pushdeer.com/message/push?pushkey=${config.push.key}&text=${title}&desp=${content}`;
            return await (await fetch(url)).json();
        } catch (ex) {
            console.log(ex);
        }
    }
}