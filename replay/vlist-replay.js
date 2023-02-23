import fetch from 'node-fetch';
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
const archives = [
    {
        // NB-Light
        authorIds: [39, 40, 41, 42, 43],
        mid: 1548358039,
        mode: 3
    }
];

(async () => {
    let tasks = [];
    for (let i = 0; i < archives.length; ++i) {
        const archive = archives[i];
        try {
            // 获取指定archive的一批B站视频源
            // 获取字幕库投稿bot中的回放列表
            const mid = 1179112593;
            const json1 = await BiliApi.findClipsFromBot(mid);
            const videos = json1.data.list.vlist;
            console.log(videos);
            
            const authorIds = archive.authorIds;
            for (let j = 0; j < authorIds.length; ++j) {
                const authorId = authorIds[j];
                tasks.push(new Promise(async (res, rej) => {
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
                        for (let k = 0; k < clips.length; ++k) {
                            const clip = clips[k];
                            // clip信息更新入库写文件的时候，因为windows系统不支持*号，所以clip.title中的*换成了_
                            // 这里去掉_以便于匹配B站源的标题
                            const modifiedTitle = clip.title.replaceAll('_', '');
                            const f1 = clip.datetime.substring(0, 10);
                            const f2 = `${clip.datetime.substring(0,4)}-${parseInt(clip.datetime.substring(5,7))}-${parseInt(clip.datetime.substring(8,10))}`;
                            const f3 = `${clip.datetime.substring(0,4)}${clip.datetime.substring(5,7)}${clip.datetime.substring(8,10)}`;
                            const f4 = `${clip.datetime.substring(0,4)}/${clip.datetime.substring(5,7)}/${clip.datetime.substring(8,10)}`;
                            // 已经包含字幕的不处理
                            const srt = await ZimuApi.findSrtByClipId(clip.id);
                            if (srt.length !== 0) {
                                continue;
                            }
                            for (let m = 0; m < videos.length; ++m) {
                                const video = videos[m];
                                // 将指定clip与所有b站video按照规则逐一对比，发现标题匹配的就执行解析
                                let matched = false;
                                if (archive.mode === 1) {
                                    const dt = `${clip.datetime.substring(0, 4)}年${parseInt(clip.datetime.substring(5, 7))}月${parseInt(clip.datetime.substring(8, 10))}日${parseInt(clip.datetime.substring(11, 13))}点场`;
                                    if (
                                        (
                                            video.title.indexOf(modifiedTitle) !== -1 || 
                                            video.title.indexOf(modifiedTitle.replaceAll(' ', '')) !== -1
                                        ) && video.title.indexOf(dt) !== -1) {
                                        matched = true;
                                    }
                                } else if (archive.mode === 2) {
                                    if (
                                        (
                                            video.title.indexOf(modifiedTitle) !== -1  ||
                                            video.title.indexOf(modifiedTitle.replaceAll(' ', '')) !== -1
                                        ) && 
                                        (
                                            video.title.indexOf(f1) !== -1 || 
                                            video.title.indexOf(f2) !== -1 || 
                                            video.title.indexOf(f3) !== -1 || 
                                            video.title.indexOf(f4) !== -1
                                        )
                                    ) {
                                        matched = true;
                                    }
                                } else if (archive.mode === 3) {
                                    if (
                                        (
                                            video.title.indexOf(modifiedTitle) !== -1 || 
                                            video.title.indexOf(modifiedTitle.replaceAll(' ', '')) !== -1
                                        ) && video.title.indexOf(author.name) !== -1 && 
                                        (
                                            video.title.indexOf(f1) !== -1 || 
                                            video.title.indexOf(f2) !== -1 || 
                                            video.title.indexOf(f3) !== -1 || 
                                            video.title.indexOf(f4) !== -1
                                        )
                                    ) {
                                        matched = true;
                                    }
                                }
                                if (matched) {
                                    // 更新clip状态
                                    try {
                                        const updatedClip = {
                                            id: clip.id,
                                            bv: video.bvid
                                        };
                                        console.log(`将更新clip:${updatedClip.id},${updatedClip.bv}`);
                                        await ZimuApi.updateClip(updatedClip);
                                        PushApi.push(`更新author(${authorId})的clip(${clip.id}),bv号为${video.bvid}`, '');
                                    } catch (ex) {
                                        console.log(ex);
                                        PushApi.push(`更新clip(${clip.title})的bv失败`, ex);
                                        continue;
                                    }
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
                        }
                        res();
                    } catch (ex) {
                        console.error(ex);
                        rej();
                    }
                }));
            }
        } catch (ex) {
            console.log(ex);
        }
    }
    try {
        await Promise.all(tasks);
    } catch (ex) {
        console.error(ex);
    }
})()