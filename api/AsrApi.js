import fetch from 'node-fetch';
import config from '../config.js';

export default class PushApi {

    static async parse(bv) {
        const url = `${config.zimu.asr.url}/asr?bv=${bv}`;
        return await (await fetch(url)).text();
    }
}