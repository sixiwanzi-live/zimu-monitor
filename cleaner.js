import { unlink, readdir } from 'fs/promises';
import moment from 'moment';
import config from './config.js';
import ZimuApi from './api/ZimuApi.js';

(async () => {
    // 获取所有组织/社团列表
    const organizations = await ZimuApi.findOrganizations();

    for (let i = 0; i < organizations.length; ++i) {
        const organizationId = organizations[i].id;
        console.log(`当前处理org:${organizations[i].name}`);
        // 获取组织/社团下的up列表
        const authors = await ZimuApi.findAuthorsByOrganizationId(organizationId);
        for (let j = 0; j < authors.length; ++j) {
            const author = authors[j];
            console.log(`当前处理author:${author.name}`);
            const clips = await ZimuApi.findClipsByAuthorId(author.id, 1, 1, 10);
            if (clips.length === 0) continue;
            const dir = `${config.zimu.live.root}/${organizationId}/${author.name}/${moment().format('YYYY-MM')}`;
            console.log(`当前处理文件夹:${dir}`);
            const files = await readdir(dir);
            for (let p = 0; p < files.length; ++p) {
                const file = files[p];
                console.log(`当前处理文件:${file}`);
                let found = false;
                for (let k = 0; k < clips.length; ++k) {
                    const clip = clips[k];
                    try {
                        if (file.indexOf(clip.title) !== -1) {
                            found = true;
                            console.log(`已匹配clip:${file}`);
                            if (clip.type === 1) {
                                await unlink(`${dir}/${file}`);
                                console.log(`B站源存在,删除成功:${dir}/${file}`);
                            }
                        }
                    } catch (ex) {
                        console.log(ex);
                    }
                    if (!found) {
                        await unlink(`${dir}/${file}`);
                        console.log(`无匹配clip,删除成功:${dir}/${file}`);
                    }
                }
            }
        }        
    }
})()