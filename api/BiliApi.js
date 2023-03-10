import fetch from 'node-fetch';
import config from '../config.js';

export default class BiliApi {

    static async findClipsFromDynamic(mid) {
        const url = `${config.bili.api.url}/x/space/wbi/arc/search?mid=${mid}&pn=1&ps=50&index=1&order=pubdate&order_avoided=true`;
        const res = await fetch(url, {
            method: 'GET',
            headers: {
                "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36 Edg/109.0.1518.70"
            }
        });
        return await res.json();
    }

    static async fetchReplayList(mid, seriesId) {const url = `${config.bili.api.url}/x/series/archives?mid=${mid}&series_id=${seriesId}&only_normal=true&sort=desc&pn=1&ps=10`;
        return await (await fetch(url)).json();
        
    }
}