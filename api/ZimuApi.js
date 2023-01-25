import fetch from 'node-fetch';
import config from '../config.js';

export default class ZimuApi {

    static async updateClip(clip) {
        const url = `${config.zimu.url}/clips/${clip.id}`;
        const res = await fetch(url, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${config.zimu.auth}`,
                'Content-Type': 'application/json;charset=utf-8'
            },
            body: JSON.stringify(clip)
        });
        return await res.json();
    }

    static async insertSubtitle(clipId, srt) {
        const url = `${config.zimu.url}/clips/${clipId}/subtitles`;
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${config.zimu.auth}`,
                'Content-Type': 'text/plain;charset=utf-8'
            },
            body: srt
        });
    }

    static async findLatestClipByAuthorId(authorId) {
        const url = `${config.zimu.url}/authors/${authorId}/latest-clip`;
        return await (await fetch(url)).json();
    }
}