import PushApi from '../api/PushApi.js';
import ZimuApi from '../api/ZimuApi.js';
import BiliApi from '../api/BiliApi.js';
import AsrApi from '../api/AsrApi.js';

const archives = [
    {
        // 扇宝
        authorIds: [30],
        mid: 1682965468,
        match: (clip, video) => {
            const modifiedTitle = clip.title.replaceAll('_', '')
            const dt1 = `${clip.datetime.substring(0,4)}${clip.datetime.substring(5,7)}${clip.datetime.substring(8,10)}`;
            return (video.title.indexOf(modifiedTitle) !== -1 || video.title.indexOf(modifiedTitle.replaceAll(' ', '')) !== -1) &&
                    video.title.indexOf('扇宝录播') !== -1 && 
                    video.title.indexOf(dt1) !== -1 ;
        }
    },
    {
        // 安可
        authorIds: [31],
        mid: 1375400985,
        match: (clip, video) => {
            const modifiedTitle = clip.title.replaceAll('_', '');
            const dt1 = clip.datetime.substring(0, 10);
            const dt2 = `${clip.datetime.substring(0,4)}-${parseInt(clip.datetime.substring(5,7))}-${parseInt(clip.datetime.substring(8,10))}`;
            return (video.title.indexOf(modifiedTitle) !== -1 || video.title.indexOf(modifiedTitle.replaceAll(' ', '')) !== -1) &&
                    video.title.indexOf('纯净版直播录像') !== -1 && 
                    (video.title.indexOf(dt1) !== -1 || video.title.indexOf(dt2) !== -1);
        }
    },
    {
        // 艾露露
        authorIds: [34],
        mid: 209730937,
        match: (clip, video, author) => {
            const dt = `${clip.datetime.substring(0,4)}${clip.datetime.substring(5,7)}${clip.datetime.substring(8,10)}`;
            return video.title.indexOf(dt) !== -1 && video.title.indexOf(author.name) !== -1;
        }
    },
    {
        // 小柔channel
        authorIds: [51],
        mid: 399726271,
        match: (clip, video, author) => {
            const modifiedTitle = clip.title.replaceAll('_', '');
            const dt = `${clip.datetime.substring(0,4)}/${clip.datetime.substring(5,7)}/${clip.datetime.substring(8,10)}`;
            return video.title.indexOf('录播') !== -1 && video.title.indexOf(dt) !== -1 && video.title.indexOf(modifiedTitle) !== -1;
        }
    },
    {
        // NB-Light
        authorIds: [39, 40, 41, 42, 43],
        mid: 1548358039,
        match: (clip, video, author) => {
            const modifiedTitle = clip.title.replaceAll('_', '');
            const dt1 = `${clip.datetime.substring(0,4)}/${clip.datetime.substring(5,7)}/${clip.datetime.substring(8,10)}`;
            const dt2 = `${clip.datetime.substring(0,4)}/${parseInt(clip.datetime.substring(5,7))}/${parseInt(clip.datetime.substring(8,10))}`;
            return (video.title.indexOf(modifiedTitle) !== -1 || video.title.indexOf(modifiedTitle.replaceAll(' ', '')) !== -1) &&
                    video.title.indexOf('直播录播') !== -1 && 
                    (video.title.indexOf(dt1) !== -1 || video.title.indexOf(dt2) !== -1) &&
                    video.title.indexOf(author.name) !== -1;
        }
    }
];

(async () => {
    let tasks = [];
    for (let i = 0; i < archives.length; ++i) {
        const archive = archives[i];
        try {
            // 获取指定archive的一批B站视频源
            // 获取字幕库投稿bot中的回放列表
            const dlist = await BiliApi.findClipsFromDynamic(archive.mid);
            const videos = dlist.data.list.vlist;
            
            const authorIds = archive.authorIds;
            for (let j = 0; j < authorIds.length; ++j) {
                const authorId = authorIds[j];
                tasks.push(new Promise(async (res, rej) => {
                    try {
                        const author = await ZimuApi.findAuthorById(authorId);
                        console.log(`处理author(${authorId},${author.name})的replay`);
                        // 查指定author是否存在直播中状态的clip
                        const clips = await ZimuApi.findClipsByAuthorId(authorId, 4, 1, 5);
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
                                const matched = archive.match(clip, video, author);
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
                    } catch (ex) {
                        console.error(ex);
                    }
                    res();
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