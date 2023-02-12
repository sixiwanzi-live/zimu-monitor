import fetch from 'node-fetch';
import PushApi from '../api/PushApi.js';
import ZimuApi from '../api/ZimuApi.js';
import { fromMilliseconds } from '../util.js'

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
        mode: 1
    },
    {
        // 安可
        authorIds: [31],
        url: 'https://api.bilibili.com/x/series/archives?mid=1375400985&series_id=2924566&only_normal=true&sort=desc&pn=1&ps=1',
        mode: 1
    },
    {
        // NB-Light
        authorIds: [39, 40, 41, 42, 43],
        url: 'https://api.bilibili.com/x/polymer/space/seasons_archives_list?mid=1548358039&season_id=1107501&sort_reverse=false&page_num=1&page_size=30',
        mode: 2
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
            console.log(videos);
            
            const authorIds = archive.authorIds;
            for (let j = 0; j < authorIds.length; ++j) {
                const authorId = authorIds[j];
                const author = await ZimuApi.findAuthorById(authorId);
                console.log(author);
                console.log(`处理author(${authorId})的replay`);
                const clips = await ZimuApi.findClipsByAuthorId(authorId, 4, 1, 20);
                if (clips.length === 0) break;
                console.log(clips);

                for (let k = 0; k < clips.length; ++k) {
                    const clip = clips[k];
                    const srt = await ZimuApi.findSrtByClipId(clip.id);
                    if (srt.length !== 0) continue;
                    for (let m = 0; m < videos.length; ++m) {
                        const video = videos[m];
                        let matched = false;
                        if (archive.mode === 1) {
                            if (video.title.indexOf(clip.title) !== -1) {
                                matched = true;
                            }
                        } else if (archive.mode === 2) {
                            if (video.title.indexOf(clip.title) !== -1 && video.title.indexOf(author.name) !== -1) {
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

            // if (video.title.indexOf(clip.title) === -1) {
            //     console.log(`author(${archive.authorId})的合集列表中无匹配录播,${video.title},${clip.title}`);
            //     continue;
            // }
            
            // // 获取录播基础信息
            // const infoUrl = `https://api.bilibili.com/x/web-interface/view?bvid=${video.bvid}`;
            // const infoRes = await fetch(infoUrl);
            // const infoJson = await infoRes.json();
            // if (!infoRes.ok) {
            //     await PushApi.push(`获取author(${archive.authorId})的录播基础信息失败(${video.bvid}, ${clip.title})`, JSON.stringify(infoJson));
            //     continue;
            // }
            // // 获取字幕信息
            // if (infoJson.data.subtitle.list.length > 0) {
            //     console.log(`author(${archive.authorId})的录播(${clip.title},${video.bvid})找到智能字幕`);
            //     const subtitleUrl = infoJson.data.subtitle.list[0].subtitle_url;
            //     const subtitleRes = await fetch(subtitleUrl);
            //     const subtitleJson = await subtitleRes.json();
            //     if (!subtitleRes.ok) {
            //         await PushApi.push(`获取录播字幕失败(${video.bvid}, ${clip.title})`, JSON.stringify(subtitleJson));
            //         continue;
            //     }
            //     // json格式字幕转换成srt格式
            //     let srt = '';
            //     const subtitles = subtitleJson.body;
            //     for (let k = 0; k < subtitles.length; ++k) {
            //         const subtitle = subtitles[k];
            //         const lineId = subtitle.sid;
            //         const startTime = fromMilliseconds(subtitle.from * 1000);
            //         const endTime = fromMilliseconds(subtitle.to * 1000);
            //         const content = subtitle.content;
            //         const line = `${lineId}\r\n${startTime} --> ${endTime}\r\n${content}\r\n\r\n`;
            //         srt += line;
            //     }
            //     try {
            //         await ZimuApi.insertSubtitle(clip.id, srt);
            //         console.log(`author(${archive.authorId})写入字幕成功:${video.bvid},${clip.datetime},${video.title}`);
            //     } catch (ex) {
            //         console.log(`author(${archive.authorId})写入字幕失败:${video.bvid},${video.title}`);
            //         await PushApi.push(`author(${archive.authorId})写入字幕失败:${video.bvid},${video.title}`, '');
            //     }
            // } else {
            //     console.log(`author(${archive.authorId})的录播(${clip.title},${video.bvid})未找到智能字幕`);
            //     await PushApi.push(`author(${archive.authorId})的录播(${clip.title},${video.bvid})未找到智能字幕`, '');
            // }
        } catch (ex) {
            console.log(ex);
        }
    }
})()