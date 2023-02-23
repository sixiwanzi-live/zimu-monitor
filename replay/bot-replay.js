import config from '../config.js';
import PushApi from '../api/PushApi.js';
import ZimuApi from '../api/ZimuApi.js';
import BiliApi from '../api/BiliApi.js';
import AsrApi from '../api/AsrApi.js';

(async () => {
    // 获取字幕库投稿bot中的回放列表
    const mid = config.bili.bot;
    const videoJson = await BiliApi.findClipsFromDynamic(mid);
    const videos = videoJson.data.list.vlist;

    let tasks = [];
    // 获取所有组织/社团列表
    const organizations = await ZimuApi.findOrganizations();

    for (let i = 0; i < organizations.length; ++i) {
        const organizationId = organizations[i].id;
        console.log(`处理org:${organizationId}`);
        // 获取组织/社团下的up列表
        const authors = await ZimuApi.findAuthorsByOrganizationId(organizationId);
        for (let j = 0; j < authors.length; ++j) {
            const author = authors[j];
            tasks.push(new Promise(async (res, rej) => {
                try {
                    const clips = await ZimuApi.findClipsByAuthorId(author.id, 3, 1, 5);
                    if (clips.length === 0) {
                        console.log(`author(${author.name})无未解析视频`);
                        res();
                        return;
                    }
                    for (let k = 0; k < clips.length; ++k) {
                        const clip = clips[k];
                        for (let m = 0; m < videos.length; ++m) {
                            const video = videos[m];
                            // 将指定clip与所有b站video按照规则逐一对比，发现标题匹配的就执行解析
                            const matched = clip.playUrl.indexOf(video.title.replaceAll(`-${clip.authorId}-`, `-${author.name}-`)) !== -1;
                            if (!matched) {
                                continue;
                            }
                            console.log(`找到匹配:${clip.playUrl}, ${video.title}`);
                            // 查找智能字幕，如果智能字幕不存在，则调用asr处理
                            let subtitles = await ZimuApi.findSubtitlesByBv(video.bvid);
                            if (subtitles.length === 0) {
                                console.log(`author(${author.id})未找到智能字幕:${video.bvid},${clip.datetime},${video.title}`);
                                PushApi.push(`author(${author.id})未找到智能字幕:${video.bvid},${clip.datetime},${video.title}`, '');
                                subtitles = await AsrApi.parse(video.bvid);
                                if (subtitles.length === 0) {
                                    console.log(`author(${clip.authorId})的录播(${video.title},${video.bvid})asr执行失败`);
                                    PushApi.push(`author(${clip.authorId})的录播(${video.title},${video.bvid})asr执行失败`, '');
                                    continue;
                                } else {
                                    console.log(`author(${clip.authorId})的录播(${video.title},${video.bvid})asr执行成功`);
                                    PushApi.push(`author(${clip.authorId})的录播(${video.title},${video.bvid})asr执行成功`, '');
                                }
                            };
                            try {
                                await ZimuApi.insertSubtitle(clip.id, subtitles);
                                console.log(`author(${author.id})写入智能字幕成功:${video.bvid},${clip.datetime},${video.title}`);
                                PushApi.push(`author(${author.id})写入智能字幕成功:${video.bvid},${clip.datetime},${video.title}`, '');
                            } catch (ex) {
                                console.log(ex);
                                console.log(`author(${author.id})写入智能字幕失败:${video.bvid},${clip.datetime},${video.title}`);
                                PushApi.push(`author(${author.id})写入智能字幕失败:${video.bvid},${clip.datetime},${video.title}`, '');
                            }
                        }
                    }
                } catch (ex) {
                    console.error(ex);
                }
                res();
            }));
        }        
    }
    try {
        await Promise.all(tasks);
    } catch (ex) {
        console.error(ex);
    }
})()