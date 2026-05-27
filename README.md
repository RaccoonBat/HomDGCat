# HomDGCat Wiki Mirror

[homdgcat.wiki](https://homdgcat.wiki) 的完整离线镜像，涵盖原神和崩坏：星穹铁道的角色、武器、圣遗物/遗器等数据。

## 内容

- [中文文档](README.zh-CN.md) | [English](README.en-US.md)

## Quick Start

### 本地开发流程

1. 请使用稳定的梯子

2. 将仓库克隆至本地后，可以直接运行以下命令, 启动本地服务器，即可看见本地站点
   
```bash

python main.py serve

```

3. 如有修改，请不要直接提交！！github 限制大于100Mb的文件上传，请使用 LFS！！！

4. 请使用 LFS 存储大文件，本地安装 github LFS 后，运行

```bash

git lfs install

git lfs track "site/TextMap/*.json"

```

5. 上述命令一定要在提交之前执行，告诉git lfs 要跟踪的文件，否则必然提交不成功

6. 后续为区分原和铁，我会将两者的文件夹逐步切分，原作者混杂在一起的数据也会整理重新上传

## 许可

本工具仅用于 homdgcat.wiki 的个人离线备份。内容版权归 MHY/妮可少女 所有。
