# CF-Workers-ChatGPT

这个项目是一个基于 Cloudflare Workers 的 ChatGPT 镜像。他能够免用户登录，使用分享的accessToken直接使用ChatGPT。

## 部署方式

**cloudflare Pages**部署：`fork` 后 `连接GitHub` 一键部署

新建一个 `KV命名空间`，并在cloudflare Pages应用程序的设置中绑定它，名称为 `oai_global_variables`。

## KV配置

| 变量名 | 示例 | 备注 | 
|--|--|--|
| at | eyJhbGciOiJSUzI1NiIs... | 你的共享accessToken |
| YOUR_DOMAIN | new.oaifree.com | 你的域名 |

## 使用方法

访问你的cloudflare Pages应用程序，输入用户名即可登录。

- **用户名**： 你独一无二的名字，用于会话隔离，可搭配accessToken使用。
- **accessToken（可选）**：如果填写，将会在KV命名空间中添加或更新对应你用户名的accessToken，再次登陆时也无需再填写accessToken，只需在过期时重新更新一下accessToken。

## 写在最后
- 本项目通过反代[new.oaifree.com](https://new.oaifree.com)实现
- 参考[LinuxDo](https://linux.do/)论坛各位大佬的代码进行修改
- 特别鸣谢始皇[neo](https://linux.do/u/neo/summary)，参考地址：[一文教你如何反代oaifree最新镜像站，以及OAuth登录](https://linux.do/t/topic/59728)