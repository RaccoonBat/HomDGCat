$(function() {

    var lazy = $('#NOLAZY').val() ? '' : 'lazy'
    var bg_name = $('#NOLAZY').val() ? 'bg_2' : 'bg'

    var meow = April_1st ? ((lang == 'CH') ? '喵' : '~') : ''
    var meow2 = April_1st ? ((lang == 'CH') ? '帕' : '~') : ''

    function start_cntd() {
        countdown_ver_1 = ""
        countdown_time_1 = 0
        countdown_note_1 = ""
        if (SR_DATES[VER_SR]) {
            countdown_ver_1 = SR_DATES[VER_SR][0]
            countdown_time_1 = SR_DATES[VER_SR][1]
            if (SR_DATES[VER_SR][2] != undefined) countdown_note_1 = "<br>" + SR_DATES[VER_SR][2][(lang == 'CH') ? 0 : 1]
            cntd_0()
            setInterval(cntd_0, 1000)
        } else {
            $('.cntd_wrap').remove()
        }
    }

    function cntd_0() {
        cntd(countdown_time_1, countdown_ver_1, '.c1_b', '.c1_a', 1722394800000, (lang == 'CH') ? '云璃' : 'Yunli', countdown_note_1)
    }

    function cntd(a, c, b, div2, birthday_stamp, char_name, _note) {
        var now = Date.now()
        var diff = a - now
        var age_d = parseInt((now - birthday_stamp) / 86400000)
        $(div2).html((lang == 'CH') ? `${char_name} : <b>${age_d}</b> 天` : `${char_name}: <b>${age_d}</b> days old`)
        if (a == 0) {
            $(b).html(c + " " + (lang == 'CH' ? '时间未知' : 'Time unknown') + _note)
            $(b + '_').html(c + " " + (lang == 'CH' ? '时间未知' : 'Time unknown') + _note)
            return
        } else if (diff < 0) {
            $(b).html(c + " " + (lang == 'CH' ? '00:00:00' : '00:00:00') + _note)
            $(b + '_').html(c + " " + (lang == 'CH' ? '00:00:00' : '00:00:00') + _note)
            return
        }
        var show = process_time(diff)
        $(b).html(c + " " + show + _note)
        $(b + '_').html(c + " " + show + _note)
        $('.fntd_time').each(function (i, t) {
            $(this).html(process_time_2(parseInt($(this).attr('data-id')) - now))
        })
    }

    function process_time(diff) {
        var days = Math.floor(diff / 86400000)
        diff -= days * 86400000
        var hours = Math.floor(diff / 3600000)
        diff -= hours * 3600000
        var minutes = Math.floor(diff / 60000)
        diff -= minutes * 60000
        var seconds = Math.floor(diff / 1000)
        if (hours < 10) hours = "0" + hours
        if (minutes < 10) minutes = "0" + minutes
        if (seconds < 10) seconds = "0" + seconds
        if (!days) {
            return hours + ":" + minutes + ":" + seconds
        } else {
            if (days < 10) days = "0" + days
            return days + ":" + hours + ":" + minutes + ":" + seconds
        }
    }

    function process_time_2(diff) {
        var days = Math.floor(diff / 86400000)
        diff -= days * 86400000
        var hours = Math.floor(diff / 3600000)
        diff -= hours * 3600000
        var minutes = Math.floor(diff / 60000)
        if (!days) {
            return hours + (lang == 'CH' ? '小时 ' : "h ")
        } else {
            return days + (lang == 'CH' ? '天 ' : "d ")
        }
    }

    function start_fntd(start_timestamp, time_list, output_table, offset, birthday_stamp, birthday_image, char_name) {

        var _now = Date.now()

        var age_d = parseInt((_now - birthday_stamp) / 86400000)
        if (age_d % 100 == 0) age_d = "<color style='color:#FF9999'>" + age_d + '</color>'
        $(output_table + '_1').render({
            img: birthday_image
        })
        $(output_table + '_2').render({
            p: (lang == 'CH') ? `${char_name} : <b>${age_d}</b> 天` : `${char_name}: <b>${age_d}</b> days old`
        })

        var data_list = []
        var cumulated_stamp = start_timestamp
        for (const ver_data of time_list) {
            if (ver_data.V != '4.0') {
                data_list.push({
                    stamp: cumulated_stamp + offset[0] * 3600000,
                    time: new Date(cumulated_stamp + offset[0] * 3600000).toISOString().substring(0, 10),
                    text: "<color style='color:rgb(255, 172, 255'><b>" + ver_data.V + '</b></color>' + (lang == 'CH' ? ' 测试服' : ' Beta')
                })
            }
            data_list.push({
                stamp: cumulated_stamp + offset[1] * 3600000,
                time: new Date(cumulated_stamp + offset[1] * 3600000).toISOString().substring(0, 10),
                text: "<color style='color:rgb(255, 172, 255'><b>" + ver_data.V + '</b></color>' + (lang == 'CH' ? ' 角色立绘' : ' Drip Marketing')
            })
            cumulated_stamp += ver_data.D * 86400000
            data_list.push({
                stamp: cumulated_stamp,
                time: new Date(cumulated_stamp).toISOString().substring(0, 10),
                text: "<color style='color:rgb(255, 172, 255'><b>" + ver_data.V + '</b></color>' + (lang == 'CH' ? ' 开启' : ' Live')
            })
            data_list.push({
                stamp: cumulated_stamp + offset[2] * 3600000,
                time: new Date(cumulated_stamp + offset[2] * 3600000).toISOString().substring(0, 10),
                text: "<color style='color:rgb(255, 172, 255'><b>" + ver_data.V + '</b></color>' + (lang == 'CH' ? ' 前瞻特别节目' : ' Special Program')
            })
        }
        data_list.sort(compare)
        for (const data_entry of data_list) {
            if (data_entry.stamp < _now) continue
            $(output_table).render({
                tr: [
                    {
                        td: data_entry.time,
                        style: {
                            'text-align': 'right'
                        }
                    },
                    {
                        td: '',
                        class: 'fntd_time',
                        a: {
                            'data-id': data_entry.stamp
                        },
                        style: {
                            'text-align': 'center'
                        }
                    },
                    {
                        td: data_entry.text,
                    }
                ]
            })
        }

    }

    function compare(a, b) {
        return a.stamp - b.stamp
    }

    document.title = txt.PAGE_TITLE[lang]

    if (lang == 'EN') {$('body').css('font-family', "'Segoe UI', sans-serif")}
    else {$('body').css('font-family', "'Microsoft YaHei', sans-serif")}

    $('h3 .title').html(txt.Title[lang] + "<color style='font-size: 28px;'><br><b>" + VER_SR + "</b></color>")

    var imgpre = $('#IMGPRE').val()
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

    $('body').on('click', '._menu_', function () {
        popLinks(lang)
    })

    $('h3 .lang').html(txt.Home_Lang)
    $('.lang').hide()

    $('container').render({
        div: [
            {
                section: [
                    {
                        schedule: txt.Home_Sections[0][lang],
                        a: {
                            'data-id': 2,
                            'class': 'active'
                        },
                        style: {
                            'display': 'flex',
                            'justify-content': 'center',
                            'flex-direction': 'column',
                            'line-height': '1.7'
                        }
                    },
                    {
                        schedule: txt.Home_Sections[1][lang],
                        a: {
                            'data-id': 3
                        },
                        style: {
                            'display': 'flex',
                            'justify-content': 'center',
                            'flex-direction': 'column',
                            'line-height': '1.7',
                            'border': '1.6px solid rgb(112, 48, 160)'
                        },
                        id: 'date_schedule'
                    },
                ],
                class: 'home_select'
            },
            {
                div: [
                    {
                        div: [
                            {
                                div: {
                                    img: '/images/emote/Yunli/1.png'
                                },
                                class: 'cntd_emote'
                            },
                            {
                                div: {
                                    p: '',
                                    class: 'c1_a',
                                },
                                class: 'c_a_w'
                            },
                        ],
                        class: 'countdown_small c1 c_f'
                    },
                    {
                        p: '',
                        class: 'countdown c1 c1_b',
                        when: 0
                    }
                ],
                class: 'cntd_wrap'
            },
            {
                div: [
                    {
                        section: [
                            {
                                schedule: {
                                    a: '/sr/boss',
                                    t: {
                                        span: (lang == 'CH') ? '怪物解析' : 'Boss Guides',
                                        style: {
                                            'margin': 'auto',
                                            'font-weight': 'bold',
                                        }
                                    }
                                },
                                class: 'hover-shadow panel',
                                style: {
                                    width: 'max-content',
                                    border: '2px solid #f29e38',
                                }
                            },
                            {
                                schedule: {
                                    a: '/sr/change',
                                    t: {
                                        span: (lang == 'CH') ? '改动汇总' : 'Track Updates',
                                        style: {
                                            'margin': 'auto',
                                            'font-weight': 'bold',
                                        }
                                    }
                                },
                                class: 'hover-shadow panel',
                                style: {
                                    width: 'max-content',
                                    border: '2px solid #f29e38',
                                }
                            },
                            {
                                schedule: {
                                    a: '/sr/future',
                                    t: {
                                        span: (lang == 'CH') ? '未来情报' : 'Future Info',
                                        style: {
                                            'margin': 'auto',
                                            'font-weight': 'bold',
                                        }
                                    }
                                },
                                class: 'hover-shadow panel',
                                style: {
                                    width: 'max-content',
                                    border: '2px solid #f29e38',
                                }
                            },
                            {
                                schedule: {
                                    a: '/sr/formulae',
                                    t: {
                                        span: '公式大全',
                                        style: {
                                            'margin': 'auto',
                                            'font-weight': 'bold',
                                        }
                                    }
                                },
                                when: lang == 'CH',
                                class: 'hover-shadow panel',
                                style: {
                                    width: 'max-content',
                                    border: '2px solid #f29e38',
                                }
                            },
                            {
                                schedule: {
                                    a: '/sr/readable',
                                    t: {
                                        span: (lang == 'CH') ? '阅读物搜索' : 'Readables Search',
                                        style: {
                                            'margin': 'auto',
                                            'font-weight': 'bold',
                                        }
                                    }
                                },
                                class: 'hover-shadow panel',
                                style: {
                                    width: 'max-content',
                                    border: '2px solid #f29e38',
                                }
                            },
                            {
                                schedule: {
                                    a: '/sr/search',
                                    t: {
                                        span: (lang == 'CH') ? '文本+剧情搜索' : 'Text+Dialogue Search',
                                        style: {
                                            'margin': 'auto',
                                            'font-weight': 'bold',
                                        }
                                    }
                                },
                                class: 'hover-shadow panel',
                                style: {
                                    width: 'max-content',
                                    border: '2px solid #f29e38',
                                }
                            },
                        ]
                    },
                ],
                class: 'd2',
                style: {
                    'justify-content': 'center'
                }
            },
            {
                section: {
                    a: `[[Link]]`,
                    t: [
                        {
                            div: [
                                {
                                    img: `[[Icon]]`,
                                    a: {
                                        loading: lazy
                                    },
                                    when: !April_1st
                                },
                                {
                                    img: '/images/avataricon/April1stOthers.png',
                                    a: {
                                        loading: lazy
                                    },
                                    when: April_1st
                                }
                            ],
                            class: 'new_image_wrapper_2'
                        },
                        {
                            div: [
                                {
                                    img: `/images/Element/[[Elem]].png`,
                                    class: 'attr_img_2',
                                    a: {
                                        loading: lazy
                                    },
                                    when: 'Elem'
                                },
                                {
                                    img: `/images/Paths/[[Type]].png`,
                                    class: 'attr_img_2',
                                    a: {
                                        loading: lazy
                                    }
                                }
                            ],
                            class: 'new_attr'
                        },
                        {
                            p: `[[Name/${lang3}]]${meow2}`,
                            class: 'new_text',
                            style: {
                                color: function (d) {
                                    return (d.data.Rarity == 5) ? '#df903b' : '#ffacff'
                                }
                            }
                        }
                    ],
                    class: 'new_block hover-shadow',
                    data: NEW_SR,
                    attr: {
                        target: '_blank'
                    }
                },
                class: 'n2'
            },
            {
                div: [],
                class: 'below'
            },
            {
                div: [
                    {
                        div: [
                            {
                                p: (lang == 'CH') ? '星穹铁道' : 'Star Rail',
                                class: 'dir_head',
                                style: {
                                    margin: '15px 5px 0'
                                }
                            },
                            {
                                p: '',
                                class: 'c2_ dir_subhead'
                            },
                            {
                                div: [
                                    {
                                        div: '',
                                        class: 'age_sub_1 table_sr_1'
                                    },
                                    {
                                        div: '',
                                        class: 'age_sub_2 table_sr_2'
                                    },
                                ],
                                class: 'age'
                            },
                            {
                                table: [],
                                class: 'ctable table_sr'
                            }
                        ],
                        class: 'futd_sr futds'
                    }
                ],
                class: 'futd'
            }
        ],
        class: 'content'
    })

    // Used to be -41 (18:00 on Monday); now it's 127 (18:00 on the next Monday)
    start_fntd(SR_Stamp, SR_Times, '.table_sr', [-25, -359, -279.5], 1722394800000, '/images/emote/Yunli/1.png', (lang == 'CH') ? '云璃' : 'Yunli')
    start_cntd()

    $('body').addClass(bg_name)

    $('body').on('click', '.home_select schedule', function () {
        if($(this).hasClass('active')) {
            return
        }
        $(this).addClass('active').siblings('schedule').removeClass('active');
        var cur_select = $(this).attr('data-id')
        switch (cur_select) {
            case '2':
                break;
            case '3':
                $('.futd').show()
                $('.below').css('background-color', 'transparent')
                $('.below').hide()
                break;
        }
        $('h3 .lang').html(txt.Home_Lang)
    })

    $('body').on('click', '.didyouknow', function() {
        didyouknow_()
    })

})
