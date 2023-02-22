import { unlink, readdir } from 'fs/promises';
import moment from 'moment';
import config from './config.js';
import ZimuApi from './api/ZimuApi.js';

(async () => {

    for (let i = 0; i < config.cleaner.authorIds.length; ++i) {
        const authorId = config.cleaner.authorIds[i];
        const author = await ZimuApi.findAuthorById(authorId);
        console.log(`当前处理author:${author.name}`);
        const clips = await ZimuApi.findClipsByAuthorId(authorId, 4, 1, 10);
        const dir = `${config.zimu.live.root}/${author.organizationId}/${author.name}/${moment().format('YYYY-MM')}`;
        console.log(`当前处理文件夹:${dir}`);
        let files = [];
        try {
            files = await readdir(dir);
        } catch (ex) {
            console.log(`文件夹不存在:${dir}`);
            break;
        }
        for (let p = 0; p < files.length; ++p) {
            const file = files[p];
            console.log(`当前处理文件:${file}`);
            let found = false;
            for (let k = 0; k < clips.length; ++k) {
                const clip = clips[k];
                try {
                    if (file.indexOf(clip.title) !== -1) {
                        found = true;
                        // await unlink(`${dir}/${file}`);
                        console.log(`直播中不删除:${dir}/${file}`);
                        break;
                    }
                } catch (ex) {
                    console.log(ex);
                }
            }
            if (!found) {
                await unlink(`${dir}/${file}`);
                console.log(`B站源存在,删除成功:${dir}/${file}`);
            }
        }
    }
})()