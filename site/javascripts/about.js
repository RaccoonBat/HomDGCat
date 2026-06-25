$(function () {

    var imgpre = $('#IMGPRE').val()

    init_title(txt.About_Title[lang] + ' ' + txt.PAGE_TITLE[lang])

    if (lang == 'EN') { $('body').css('font-family', "'Segoe UI', sans-serif") }
    else { $('body').css('font-family', "'Microsoft YaHei', sans-serif") }

    $('h3 .title').html(txt.Title[lang])
    $('h3 .lang').html(txt.Home_Lang)
    $('h3 .lang').hide()
    $('h3 .links').render([
        {
            img: imgpre + 'images/menu.png',
            class: '_menu_'
        },
        {
            img: imgpre + 'images/translate.png',
            class: '_translate_'
        }
    ]);
    $('h3 .links').css('margin-top', '23px')

    $('body').on('click', '._menu_', function () {
        popLinks(lang)
    })

    var desc = [
        {
            CH: '我目前是一名学生，在研究学习之余创建了玉衡杯数据库；现在的整个数据库都是<color style="color:#FFD780;">我一人制作和维护</color>的',
            EN: 'I am currently a student, and I created HomDGCat Wiki in my spare time. Now the entire wiki is written and <color style="color:#FFD780;">maintained by me alone</color>.'
        },
        {
            CH: '我运营玉衡杯数据库的目的，是为了给各位玩家高效地提供数据，让所有人都能方便地获取自己需要的信息',
            EN: 'The goal of HomDGCat Wiki is to efficiently provide data for all players, so that everyone can easily obtain the information that they need.'
        },
        {
            CH: '玉衡杯数据库不仅有官方信息，也有很多我自己创作的内容，例如角色的<color style="color:#FFD780;">深度机制数值</color>（妮可少女的研究），以及新怪物的<color style="color:#FFD780;">详细技能数据</color>和<color style="color:#FFD780;">机制解析</color>（怪物解析）',
            EN: 'Apart from official data, there is also a lot of stuff written by me. For example characters\' <color style="color:#FFD780;">advanced data</color> (HomDGCat\'s Notes) and <color style="color:#FFD780;">guides on the mechanics</color> of new enemies (Boss Guides).'
        },
        {
            CH: '玉衡杯数据库会在第一时间更新最新的数据',
            EN: 'HomDGCat Wiki updates data as soon as the game updates are out. '
        },
    ]

    var text = [
        [
            {
                CH: '赞助',
                EN: 'Support'
            },
            {
                CH: '运营维护数据库不易，下面是一些赞助方式~',
                EN: 'Maintaining the wiki is hard work. Below are some ways to support~'
            }
        ],
        [
            {
                CH: '关于我：妮可少女',
                EN: 'About Me: HomDGCat'
            },
            {
                CH: '我在星穹铁道开服后就开始研究星穹铁道的<color style="color:#FFD780;"><b>数据机制</b></color>。最初吸引我的问题是，混沌回忆中怪物的血量是如何计算和设置的？这是我研究<color style="color:#FFD780;"><b>星穹铁道数据</b></color>的契机。',
                EN: 'I started researching <color style="color:#FFD780;"><b>HSR game data and mechanics</b></color> when the game was released. The first question that intrigued me was: How is the HP of the enemies in Memory of Chaos calculated? This is how I got into <color style="color:#FFD780;"><b>datamining</b></color>.'
            },
            {
                CH: '在研究数据的过程中，我看到了<color style="color:#FFD780;"><b>云璃</b></color>的立绘。看到云璃的第一眼我就知道，她是我在星穹铁道里命中注定的单推！',
                EN: 'While researching game data, I saw <color style="color:#FFD780;"><b>Yunli</b></color>\'s drip marketing. The moment I saw Yunli, I knew she will be my favourite HSR character forever!'
            }
        ],
        [
            {
                CH: '玉衡杯数据库的历史',
                EN: 'Wiki\'s History'
            },
            {
                CH: '玉衡杯数据库最初是为参加比赛选手提供信息的数据库，后来逐渐发展为今天的星穹铁道数据平台。',
                EN: 'HomDGCat Wiki was originally made for contestants to look up game data. It has gradually grown into the HSR data platform it is today.'
            },
            {
                CH: '在 <color style="color:#FFD780;"><b>2023</b></color> 年，我给玉衡杯数据库独立了出来，并加入了星穹铁道的部分，玉衡杯数据库逐渐发展成了今天的模样。',
                EN: 'In <color style="color:#FFD780;"><b>2023</b></color>, I created an independent site for HomDGCat Wiki and added the Honkai Star Rail part. The Wiki gradually grew to what it is today.'
            }
        ],
        [
            {
                CH: '喜欢的东西~',
                EN: 'Things I Like~'
            },
            {
                CH: '我最喜欢的周本战斗曲是<color style="color:#FFD780;">《蚀形的灾祲》</color>（古斯托特）',
                EN: 'My favourite Weekly Boss BGM is <color style="color:#FFD780;"><b>Vitas Corrodens Pestis</b></color> (Gosoythoth)'
            },
            {
                CH: '星穹铁道暂时没什么特别喜欢的音乐...',
                EN: 'Currently there isn\'t any music in HSR that I really like...'
            },
            {
                CH: '我是<color style="color:#FFD780;">《风灵玉秀》</color>狂热粉！这是为数不多我看过的动漫之一，我的另一个网名「风铃儿」就取自其中的两位女主中的风铃儿',
                EN: ''
            }
        ],
        [
            {
                CH: '数据库的<color style="color:#FFD780;">各种</color><color style="color:#F29E38;">颜色</color>',
                EN: 'Wiki\'s <color style="color:#FFD780;">Multiple</color> <color style="color:#F29E38;">Colors</color>'
            },
            {
                CH: '文字颜色二：<color style="color:#F29E38;"><b> #F29E38 </b></color>，这是星穹铁道的高亮文字颜色',
                EN: 'Text highlight 2:<color style="color:#F29E38;"> <b> #F29E38 </b></color> . This is the color of highlighted text in HSR.'
            }
        ],
    ]

    $('body').addClass(bg_name)

    $('container').render({
        template: {
            div: {
                div: [
                    {
                        p: (lang == 'CH') ? '妮可少女' : 'HomDGCat',
                        class: 'bigname'
                    },
                    {
                        div: [
                            {
                                div: [
                                    {
                                        img: '/images/emote/Yunli/1.png'
                                    },
                                    {
                                        img: '/images/emote/Yunli/2.png'
                                    },
                                    {
                                        img: '/images/emote/Yunli/3.png',
                                        when: window.innerWidth >= 600
                                    },
                                ],
                                class: 'emotes'
                            },
                            {
                                p: desc[0][lang],
                                class: 'desc'
                            },
                            {
                                p: desc[1][lang],
                                class: 'desc'
                            },
                            {
                                p: desc[2][lang],
                                class: 'desc'
                            },
                            {
                                p: desc[3][lang],
                                class: 'desc'
                            },
                        ],
                        class: 'block_0 blk',
                    },
                    {
                        div: [
                            {
                                p: text[0][0][lang],
                                class: 'name'
                            },
                            {
                                p: text[0][1][lang],
                                class: 'desc2',
                                style: {
                                    'text-align': 'center'
                                }
                            },
                            {
                                p: `Patreon: <a href='https://www.patreon.com/c/homdgcat/shop' target='_blank'>www.patreon.com/c/homdgcat/shop</a>`,
                                class: 'desc2',
                                style: {
                                    'text-align': 'center'
                                }
                            },
                        ],
                        class: 'block_1 blk',
                        when: 0
                    },
                    {
                        div: [
                            {
                                p: text[1][0][lang],
                                class: 'name'
                            },
                            {
                                p: text[1][1][lang],
                                class: 'desc2'
                            },
                            {
                                p: text[1][2][lang],
                                class: 'desc2'
                            }
                        ],
                        class: 'block_0 blk',
                    },
                    {
                        div: [
                            {
                                p: text[2][0][lang],
                                class: 'name'
                            },
                            {
                                p: text[2][1][lang],
                                class: 'desc2'
                            },
                            {
                                p: text[2][2][lang],
                                class: 'desc2'
                            }
                        ],
                        class: 'block blk',
                    },
                    {
                        div: [
                            {
                                p: text[3][0][lang],
                                class: 'name'
                            },
                            {
                                p: text[3][1][lang],
                                class: 'desc2'
                            },
                            {
                                p: text[3][2][lang],
                                class: 'desc2'
                            }
                        ],
                        class: 'block blk',
                    },
                    {
                        div: [
                            {
                                p: text[4][0][lang],
                                class: 'name'
                            },
                            {
                                p: text[4][1][lang],
                                class: 'desc2'
                            }
                        ],
                        class: 'block blk',
                    },
                ],
                class: 'mon_body'
            },
            class: 'content',
            style: {
                'padding-left': '0',
                'padding-right': '0',
            }
        }
    })
})