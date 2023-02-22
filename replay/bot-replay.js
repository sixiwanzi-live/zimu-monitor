import PushApi from '../api/PushApi.js';
import ZimuApi from '../api/ZimuApi.js';
import BiliApi from '../api/BiliApi.js';
import AsrApi from '../api/AsrApi.js';

(async () => {
    // 获取字幕库投稿bot中的回放列表
    const json1 = await BiliApi.findClipsFromBot();
    const replays = json1.data.list.vlist;

    // 获取所有组织/社团列表
    const organizations = await ZimuApi.findOrganizations();

    for (let i = 0; i < organizations.length; ++i) {
        const organizationId = organizations[i].id;
        console.log(`org:${organizationId}`);
        // 获取组织/社团下的up列表
        const authors = await ZimuApi.findAuthorsByOrganizationId(organizationId);
        for (let j = 0; j < authors.length; ++j) {
            const author = authors[j];
            const clips = await ZimuApi.findClipsByAuthorId(author.id, 3, 1, 5);
            if (clips.length === 0) continue;
            for (let k = 0; k < clips.length; ++k) {
                const clip = clips[k];
                const srt = await ZimuApi.findSrtByClipId(clip.id);
                if (srt.length !== 0) continue;
                // 查找与没有字幕clip匹配的投稿
                for (let m = 0; m < replays.length; ++m) {
                    const replay = replays[m];
                    if (clip.playUrl.indexOf(replay.title.replaceAll(`-${clip.authorId}-`, `-${author.name}-`)) !== -1) {
                        console.log(`找到匹配:${clip.playUrl}, ${replay.title}`);
                        let subtitles = await ZimuApi.findSubtitlesByBv(replay.bvid);
                        if (subtitles.length === 0) {
                            PushApi.push(`author(${clip.authorId})的录播(${clip.title},${replay.bvid})未找到智能字幕`, '');
                            subtitles = await AsrApi.parse(replay.bvid);
                            if (subtitles.length === 0) {
                                PushApi.push(`author(${clip.authorId})的录播(${replay.title},${replay.bvid})asr执行失败`, '');
                                continue;
                            }
                        }
                        try {
                            await ZimuApi.insertSubtitle(clip.id, subtitles);
                            const message = `author(${clip.authorId})写入字幕成功:${replay.bvid},${clip.datetime},${clip.title}`;
                            console.log(message);
                            PushApi.push(message, '');
                        } catch (ex) {
                            const message = `author(${clip.authorId})写入字幕失败:${replay.bvid},${clip.title}`;
                            console.log(message);
                            PushApi.push(message, '');
                        }
                    }
                }
            }
        }        
    }
})()