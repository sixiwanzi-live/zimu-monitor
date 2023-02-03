import fetch from 'node-fetch';
import PushApi from '../api/PushApi.js';
import ZimuApi from '../api/ZimuApi.js';
import BiliApi from '../api/BiliApi.js';
import { fromMilliseconds } from '../util.js'

(async () => {
    const maxSearchClips = 20;
    // 获取字幕库投稿bot中的回放列表
    const json1 = await BiliApi.findClipsFromBot();
    const replays = json1.data.list.vlist;

    // 获取所有组织/社团列表
    const organizations = await ZimuApi.findOrganizations();

    for (let i = 0; i < organizations.length; ++i) {
        const organizationId = organizations[i].id;
        console.log(`org:${organizationId}`);
        const clips = await ZimuApi.findClipsByOrganizationId(organizationId);
        for (let j = 0; j < clips.length && j < maxSearchClips; ++j) {
            const clip = clips[j];
            const srt = await ZimuApi.findSrtByClipId(clip.id);
            if (srt.length !== 0) continue;
            // 查找与没有字幕clip匹配的投稿
            for (let k = 0; k < replays.length; ++k) {
                const replay = replays[k];
                if (clip.playUrl.indexOf(replay.title) !== -1) {
                    console.log(`找到匹配:${clip.playUrl}, ${replay.title}`);
                    const json2 = await BiliApi.fetchVideoInfo(replay.bvid);
                    if (!json2) {
                        PushApi.push(`author(${clip.authorId})的录播(${clip.title},${replay.bvid})未找到基础信息`, '');
                        continue;
                    }
                    // 获取字幕信息
                    if (json2.data.subtitle.list.length > 0) {
                        console.log(`author(${clip.authorId})的录播(${clip.title},${replay.bvid})找到智能字幕`);
                        const subtitleUrl = json2.data.subtitle.list[0].subtitle_url;
                        const subtitleRes = await fetch(subtitleUrl);
                        const subtitleJson = await subtitleRes.json();
                        if (!subtitleJson) {
                            PushApi.push(`author(${clip.authorId})的录播(${clip.title},${replay.bvid})获取智能字幕失败`, '');
                            continue;
                        }
                        // json格式字幕转换成srt格式
                        let srt = '';
                        const subtitles = subtitleJson.body;
                        for (let k = 0; k < subtitles.length; ++k) {
                            const subtitle = subtitles[k];
                            const lineId = subtitle.sid;
                            const startTime = fromMilliseconds(subtitle.from * 1000);
                            const endTime = fromMilliseconds(subtitle.to * 1000);
                            const content = subtitle.content;
                            const line = `${lineId}\r\n${startTime} --> ${endTime}\r\n${content}\r\n\r\n`;
                            srt += line;
                        }
                        try {
                            await ZimuApi.insertSubtitle(clip.id, srt);
                            const message = `author(${clip.authorId})写入字幕成功:${replay.bvid},${clip.datetime},${clip.title}`;
                            console.log(message);
                            // PushApi.push(message, '');
                        } catch (ex) {
                            const message = `author(${clip.authorId})写入字幕失败:${replay.bvid},${clip.title}`;
                            console.log(message);
                            await PushApi.push(message, '');
                        }
                    } else {
                        const message = `author(${clip.authorId})的录播(${clip.title},${replay.bvid})未找到智能字幕`;
                        console.log(message);
                        PushApi.push(message, '');
                    }
                }
            }
        }
    }
})()