import path from "path";
import { VK } from "vk-io";
import { WallWallpostFull } from "vk-io/lib/api/schemas/objects";
import appConfig from "../configs/appConfig.json";

class Vk {
  private static async getGoodPosts(vk: VK, owner_id: number) {
    const res = await vk.api.wall.get({
      owner_id: -Math.abs(owner_id),
      count: 2,
      filter: "all",
    });

    const posts = res.items.filter((post) => !post.is_pinned);

    const goodPosts: WallWallpostFull[] = [];

    const checkPost = async (post: WallWallpostFull) => {
      if (!post.date) {
        return false;
      }

      //   if (after && moment(after).isAfter(moment(post.date * 1000))) {
      //     return false;
      //   }

      if (post.marked_as_ads !== 0) {
        return false;
      }

      if (post?.text === appConfig.text) {
        return false;
      }
      //   const exists = await Messages.exists(post.text);
      //   if (exists) {
      //     return false;
      //   }

      return true;
    };

    for (let post of posts) {
      if (post.copy_history && Array.isArray(post.copy_history)) {
        for (let copyPost of post.copy_history) {
          const isOk = await checkPost(copyPost);
          if (isOk) {
            goodPosts.push(post);
          }
        }
      }

      const isOk = await checkPost(post);
      if (isOk) {
        goodPosts.push(post);
      }
    }

    return goodPosts;
  }

  static async postAdsTask(vk: VK) {
    const groupId = appConfig.groupId;

    try {
      const posts = await Vk.getGoodPosts(vk, groupId);

      const post = posts[0];

      const text = appConfig.text;
      console.log(post);

      if (!post) {
        return;
      }

      // const file = await vk.upload.wallPhoto({
      //   source: {
      //     value: path.resolve(__dirname, "../photos/attachment.jpg"),
      //   },
      // });

      await vk.api.wall.post({
        owner_id: -Math.abs(groupId),
        message: text,
        // attachments: file.toString(),
        from_group: true,
      });
    } catch (e) {
      console.log(groupId, e);
    }
  }

  static async init() {
    const pool = new VkPool(appConfig.tokens);

    const MINUT = 1000 * 60;

    setInterval(() => {
      const vk = pool.getClient();

      Vk.postAdsTask(vk);
    }, (1 / 12) * MINUT);
  }
}

class VkPool {
  private poolItems: {
    vk: VK;
    count: number;
  }[] = [];

  constructor(tokens: string[]) {
    for (let token of tokens) {
      const vk = new VK({
        token,
        apiVersion: "5.131",
        language: "ru",
        apiTimeout: 10000,
      });

      this.poolItems.push({
        vk,
        count: 0,
      });
    }
  }

  getClient(): VK {
    let leastClientIdx = 0;
    let leastCount = this.poolItems[0].count;

    for (let i = 0; i < this.poolItems.length; i++) {
      const poolItem = this.poolItems[i];

      if (poolItem.count < leastCount) {
        leastClientIdx = i;
        leastCount = poolItem.count;
      }
    }

    const client = this.poolItems[leastClientIdx].vk;

    this.poolItems[leastClientIdx].count += 1;

    return client;
  }
}

export { Vk };
