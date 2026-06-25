NEW_SR = [
    {
        "Name": {
            "CH": "大丽花",
            "EN": "The Dahlia",
            "JP": "ダリア",
            "KR": "달리아"
        },
        "Rarity": 5,
        "Link": "/sr/char/1321",
        "Icon": "/images/avataricon/avatar/1321.png",
        "Elem": "Fire",
        "Type": "Nihility"
    },
    {
        "Name": {
            "CH": "勿忘她的火焰",
            "EN": "Never Forget Her Flame",
            "JP": "彼女の炎を忘れずに",
            "KR": "그녀의 불꽃을 잊지 말라"
        },
        "Rarity": 5,
        "Link": "/sr/char/23050",
        "Icon": "/images/lightconemediumicon/23050.png",
        "Type": "Nihility"
    }
]//SR

var sr_ch = []
var sr_en = []

for (const i of NEW_SR) {
    if (i.Elem) {
        sr_ch.push(i.Name.CH)
        sr_en.push(i.Name.EN)
    }
}

document.querySelector('meta[name="description"]').setAttribute("content", `Star Rail ${VER_SR.substring(0, 3)}: ${sr_en.join(', ')} | 星穹铁道 ${VER_SR.substring(0, 3)}: ${sr_ch.join('、')}`);