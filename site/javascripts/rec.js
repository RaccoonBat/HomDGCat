$(function () {

    var imgpre = $('#IMGPRE').val()

    document.title = txt.PAGE_TITLE[lang]

    if (lang == 'EN') { $('body').css('font-family', "'Segoe UI', sans-serif") }
    else { $('body').css('font-family', "'Microsoft YaHei', sans-serif") }

    WikiUI.headerTitle();
    $('h3 .lang').html(txt.Home_Lang)
    $('h3 .lang').hide()
    WikiUI.menuIcons(imgpre);

    $('body').on('click', '._menu_', function () {
        popLinks(lang)
    })


    let script_computer = document.createElement('script')
    script_computer.src = '/data/' + lang3 + '/Rec.js'
    document.head.append(script_computer)
    script_computer.onload = begin

    function begin() {
        cur_group = _n

        $('container').render({
            template: {
                div: [
                    {
                        section: {
                            schedule: `[[Name]]`,
                            data: _recgroup,
                            a: {
                                class: function (k) {
                                    if (k.data._id == cur_group) return 'active'
                                    return ''
                                },
                                'data-id': `[[_id]]`
                            }
                        },
                        class: 'choose',
                    },
                    {
                        div: [],
                        class: 'miracle_card_area'
                    }
                ],
                class: 'content'
            }
        })

        renderREC()

        $('body').addClass(bg_name)
    }

    function renderREC() {
        _rec.forEach(function (t, i) {
            if (t.Group != cur_group) return
            $('.miracle_card_area').render({
                div: [
                    {
                        img: imgpre + 'images/itemfigures/210001.png',
                        class: 'icon'
                    },
                    {
                        p: t.Name,
                        class: 'name'
                    },
                    {
                        p: `[[.]]`,
                        class: 'desc',
                        data: t.Unlock,
                        style: {
                            'font-size': '0.9em'
                        }
                    },
                    {
                        hr: '',
                        style: {
                            margin: '15px 0'
                        }
                    },
                    {
                        p: `[[.]]`,
                        class: 'desc',
                        data: t.Desc
                    },
                ],
                class: 'curio'
            })
        })
    }

    $('body').on('click', '.choose schedule', function () {
        if ($(this).hasClass('active')) {
            return;
        }
        $(this).addClass('active').siblings('schedule').removeClass('active');
        cur_group = parseInt($(this).attr('data-id'))
        $('.miracle_card_area').empty()
        renderREC()
    })

})