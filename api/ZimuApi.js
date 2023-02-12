import fetch from 'node-fetch';
import config from '../config.js';

export default class ZimuApi {

    static async updateClip(clip) {
        const url = `${config.zimu.api.url}/clips/${clip.id}`;
        const res = await fetch(url, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${config.zimu.api.auth}`,
                'Content-Type': 'application/json;charset=utf-8'
            },
            body: JSON.stringify(clip)
        });
        return await res.json();
    }

    static async insertSubtitle(clipId, srt) {
        const url = `${config.zimu.api.url}/clips/${clipId}/subtitles`;
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${config.zimu.api.auth}`,
                'Content-Type': 'text/plain;charset=utf-8'
            },
            body: srt
        });
    }

    static async findOrganizations() {
        const url = `${config.zimu.api.url}/organizations`;
        return await (await fetch(url)).json();
    }

    static async findAuthorsByOrganizationId(organizationId) {
        const url = `${config.zimu.api.url}/organizations/${organizationId}/authors`;
        return await (await fetch(url)).json();
    }

    static async findAuthorById(authorId) {
        const url = `${config.zimu.api.url}/authors/${authorId}`;
        return await (await fetch(url)).json();
    }

    static async findClipsByOrganizationId(organizationId) {
        const url = `${config.zimu.api.url}/organizations/${organizationId}/clips`;
        return await (await fetch(url)).json();
    }

    static async findClipsByAuthorId(authorId, type, page, size) {
        const url = `${config.zimu.api.url}/authors/${authorId}/clips?type=${type}&page=${page}&size=${size}`;
        return await (await fetch(url)).json();
    }

    static async findSrtByClipId(clipId) {
        const url = `${config.zimu.api.url}/clips/${clipId}/srt`;
        return await (await fetch(url)).text();
    }

    static async findSubtitlesByBv(bv) {
        const url = `${config.zimu.tool.url}/subtitles?bv=${bv}`;
        return await (await fetch(url)).text();
    }
}