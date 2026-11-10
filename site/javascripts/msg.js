$(function () {

    var imgpre = $('#IMGPRE').val()
    var avid = $('#AVID').val()

    document.title = txt.PAGE_TITLE[lang]

    if (lang == 'EN') { $('body').css('font-family', "'Segoe UI', sans-serif") }
    else { $('body').css('font-family', "'Microsoft YaHei', sans-serif") }

    WikiUI.headerTitle();
    $('h3 .lang').html(txt.Lang[lang])
    $('h3 .lang').hide()
    WikiUI.menuIcons(imgpre);

    $('body').on('click', '._menu_', function () {
        popLinks(lang)
    })

    begin()

    function begin() {

        $('container').render({
            div: [
                {
                    h4: {'CH': '敬请期待', 'EN': 'Coming Soon'}[lang],
                    style: {
                        'font-weight': 'bold',
                        'text-align': 'center',
                        'font-size': '23px'
                    }
                }
            ],
            class: 'content'
        })

        $('body').addClass(bg_name)

    }

})