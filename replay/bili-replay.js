import fetch from 'node-fetch';
import PushApi from '../api/PushApi.js';
import ZimuApi from '../api/ZimuApi.js';

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
        // AI中国绊爱
        authorIds: [8],
        url: 'https://api.bilibili.com/x/series/archives?mid=484322035&series_id=210661&only_normal=true&sort=desc&pn=1&ps=1',
        mode: 1
    },
    {
        // 凜凜蝶凜
        authorIds: [21],
        url: 'https://api.bilibili.com/x/series/archives?mid=1220317431&series_id=2610314&only_normal=true&sort=desc&pn=1&ps=1',
        mode: 1
    },
    {
        // 灯夜tomoya
        authorIds: [29],
        url: 'https://api.bilibili.com/x/series/archives?mid=1854400894&series_id=2880259&only_normal=true&sort=desc&pn=1&ps=1',
        mode: 1
    },
    {
        // 扇宝
        authorIds: [30],
        url: 'https://api.bilibili.com/x/polymer/space/seasons_archives_list?mid=1682965468&season_id=1022826&sort_reverse=false&page_num=1&page_size=1',
        mode: 2
    },
    {
        // 安可
        authorIds: [31],
        url: 'https://api.bilibili.com/x/series/archives?mid=1375400985&series_id=2924566&only_normal=true&sort=desc&pn=1&ps=1',
        mode: 2
    },
    {
        // NB-Light
        authorIds: [39, 40, 41, 42, 43],
        url: 'https://api.bilibili.com/x/polymer/space/seasons_archives_list?mid=1548358039&season_id=1107501&sort_reverse=false&page_num=1&page_size=30',
        mode: 3
    }
];

(async () => {
    for (let i = 0; i < archives.length; ++i) {
        const archive = archives[i];
        try {
            // 获取B站视频源
            let videos = [];
            const archiveRes = await fetch(archive.url);  // 请求合集列表
            const archiveJson = await archiveRes.json();
            if (!archiveRes.ok) {
                await PushApi.push(`请求B站合集列表失败`, JSON.stringify(archiveJson));
                continue;
            }
            videos = archiveJson.data.archives;
            
            const authorIds = archive.authorIds;
            for (let j = 0; j < authorIds.length; ++j) {
                const authorId = authorIds[j];
                const author = await ZimuApi.findAuthorById(authorId);
                console.log(`处理author(${authorId},${author.name})的replay`);
                const clips = await ZimuApi.findClipsByAuthorId(authorId, 4, 1, 20);
                if (clips.length === 0) continue;

                for (let k = 0; k < clips.length; ++k) {
                    const clip = clips[k];
                    const f1 = clip.datetime.substring(0, 10);
                    const f2 = `${clip.datetime.substring(0,4)}-${parseInt(clip.datetime.substring(5,7))}-${parseInt(clip.datetime.substring(8,10))}`;
                    const f3 = `${clip.datetime.substring(0,4)}${clip.datetime.substring(5,7)}${clip.datetime.substring(8,10)}`;
                    const f4 = `${clip.datetime.substring(0,4)}/${clip.datetime.substring(5,7)}/${clip.datetime.substring(8,10)}`;
                    const srt = await ZimuApi.findSrtByClipId(clip.id);
                    if (srt.length !== 0) continue;
                    for (let m = 0; m < videos.length; ++m) {
                        const video = videos[m];
                        let matched = false;
                        if (archive.mode === 1) {
                            const dt = `${clip.datetime.substring(0, 4)}年${parseInt(clip.datetime.substring(5, 7))}月${parseInt(clip.datetime.substring(8, 10))}日${parseInt(clip.datetime.substring(11, 13))}点场`;
                            if (
                                (
                                    video.title.indexOf(clip.title) !== -1 || 
                                    video.title.indexOf(clip.title.replaceAll(' ', '')) !== -1
                                ) && video.title.indexOf(dt) !== -1) {
                                matched = true;
                            }
                        } else if (archive.mode === 2) {
                            if (
                                (
                                    video.title.indexOf(clip.title) !== -1  ||
                                    video.title.indexOf(clip.title.replaceAll(' ', '')) !== -1
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
                                    video.title.indexOf(clip.title) !== -1 || 
                                    video.title.indexOf(clip.title.replaceAll(' ', '')) !== -1
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
                            // 找到匹配的未处理字幕的clip
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
                            const subtitles = await ZimuApi.findSubtitlesByBv(video.bvid);
                            if (subtitles.length === 0) {
                                console.log(`author(${authorId})未找到智能字幕:${video.bvid},${clip.datetime},${video.title}`);
                                PushApi.push(`author(${authorId})未找到智能字幕:${video.bvid},${clip.datetime},${video.title}`, '');
                                continue;
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
            }
        } catch (ex) {
            console.log(ex);
        }
    }
})()