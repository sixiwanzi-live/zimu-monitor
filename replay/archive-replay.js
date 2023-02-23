import config from '../config.js';
import PushApi from '../api/PushApi.js';
import ZimuApi from '../api/ZimuApi.js';
import BiliApi from '../api/BiliApi.js';
import AsrApi from '../api/AsrApi.js';

/**
 * 日期格式有如下几种
 * F1:YYYY-MM-DD
 * F2:YYYY-m-d
 * F3:YYYYMMDD
 * F4:YYYY/MM/DD
 * mode=1 适配官方录播回放源,含标题,日期格式为YYYY年M月D日H点场
 * mode=2 适配录播man，含标题，日期
 * mode=3 适配录播man，含标题，up名称，日期
 */
// const archives = [
//     {
//         // AI中国绊爱
//         authorId: 8,
//         url: 'https://api.bilibili.com/x/series/archives?mid=484322035&series_id=210661&only_normal=true&sort=desc&pn=1&ps=10',
//     },
//     {
//         // 凜凜蝶凜
//         authorId: 21,
//         url: 'https://api.bilibili.com/x/series/archives?mid=1220317431&series_id=2610314&only_normal=true&sort=desc&pn=1&ps=10'
//     },
//     {
//         // 灯夜tomoya
//         authorId: 29,
//         url: 'https://api.bilibili.com/x/series/archives?mid=1854400894&series_id=2880259&only_normal=true&sort=desc&pn=1&ps=10'
//     }
// ];


(async () => {
    let tasks = [];
    for (let i = 0; i < config.bili.replay.length; ++i) {
        const seriesId = config.bili.replay[i].seriesId;
        const authorId = config.bili.replay[i].authorId;
        // 查询author信息
        tasks.push(new Promise(async(res, rej) => {
            try {
                const author = await ZimuApi.findAuthorById(authorId);
                console.log(`处理author(${authorId},${author.name})的replay`);
                // 查指定author是否存在直播中状态的clip
                const clips = await ZimuApi.findClipsByAuthorId(authorId, 4, 1, 20);
                if (clips.length === 0) {
                    console.log(`author(${author.name})无未解析视频`);
                    res();
                    return;
                }
                const videoJson = await BiliApi.fetchReplayList(author.uid, seriesId);
                const videos = videoJson.data.archives;
                console.log(videoJson);

                for (let k = 0; k < clips.length; ++k) {
                    const clip = clips[k];
                    const modifiedTitle = clip.title.replaceAll('_', '');
                    const dt = `${clip.datetime.substring(0, 4)}年${parseInt(clip.datetime.substring(5, 7))}月${parseInt(clip.datetime.substring(8, 10))}日${parseInt(clip.datetime.substring(11, 13))}点场`;
                    for (let m = 0; m < videos.length; ++m) {
                        const video = videos[m];
                        const matched = (video.title.indexOf(modifiedTitle) !== -1 || video.title.indexOf(modifiedTitle.replaceAll(' ', '')) !== -1) &&
                                        video.title.indexOf(dt) !== -1;
                        if (!matched) {
                            continue;
                        }
                        // 更新clip状态
                        const updatedClip = {
                            id: clip.id,
                            bv: video.bvid
                        };
                        console.log(`将更新clip:${updatedClip.id},${updatedClip.bv}`);
                        await ZimuApi.updateClip(updatedClip);
                        PushApi.push(`更新author(${authorId})的clip(${clip.id}),bv号为${video.bvid}`, '');
                        // 查找智能字幕，如果智能字幕不存在，则调用asr处理
                        let subtitles = await ZimuApi.findSubtitlesByBv(video.bvid);
                        if (subtitles.length === 0) {
                            console.log(`author(${authorId})未找到智能字幕:${video.bvid},${clip.datetime},${video.title}`);
                            PushApi.push(`author(${authorId})未找到智能字幕:${video.bvid},${clip.datetime},${video.title}`, '');
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
                            console.log(`author(${authorId})写入智能字幕成功:${video.bvid},${clip.datetime},${video.title}`);
                            PushApi.push(`author(${authorId})写入智能字幕成功:${video.bvid},${clip.datetime},${video.title}`, '');
                        } catch (ex) {
                            console.log(ex);
                            console.log(`author(${authorId})写入智能字幕失败:${video.bvid},${clip.datetime},${video.title}`);
                            PushApi.push(`author(${authorId})写入智能字幕失败:${video.bvid},${clip.datetime},${video.title}`, '');
                        }
                    }               
                }
            } catch (ex) {
                console.error(ex);
            }
            res();
        }));
    }
    try {
        await Promise.all(tasks);
    } catch (ex) {
        console.error(ex);
    }
})()