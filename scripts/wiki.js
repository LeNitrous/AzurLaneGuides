class ALWikiApi {
    constructor() {
        this.host = "https://azurlane.koumakan.jp";
        this.version = "Yuubari/0.0.9";
    }

    async query(page) {
        page = page.replace(/ /g, '_');

        var data = await $.ajax({
            url: `${this.host}/w/api.php?action=parse&page=${page}&format=json`,
            dataType: 'jsonp',
            jsonp: 'callback',
            jsonpCallback: 'jsonpCallback',
            headers: {
                'User-Agent': `ALWiki API by @LeNitrous ver. ${this.version}`
            }
        });

        if (data.error)
            throw new Error(data.error.info);

        return $($.parseHTML(data.parse.text['*'].replace(/\n/g, '')));
    }

    async getShip(name) {
        var root = await this.query(name);
        var vo = await this.query(name + '/Quotes');
        var self = this;
        return {
            id: root.find('th:contains("ID")').siblings('td').first().text(),
            name: root.find('.azl_box_title').text(),
            type: root.find('th:contains("Classification")').siblings('td').first().children()
                .map(function() { return $(this).text() }).toArray()
                .filter(type => type.length > 0),
            class: root.find('th:contains("Class")').siblings('td').first().text(),
            nation: root.find('th:contains("Nationality")').siblings('td').first().children().text(),
            rarity: root.find('th:contains("Rarity")').siblings('td').first().children().first().first().attr('title'),
            icon: this.host + root.find('a.image').children('img').first().attr('src'),
            equips: root.find('th:contains("Equipment")').parents('tbody').children('tr')
                .map(function(i) {
                    if (i == 1) return;

                    return $(this).children('td').last().text();
                }).toArray().filter(item => item.length > 3).slice(3)
                .map(function(item) {
                    return item.split('/')
                        .map(str => {
                            var str = str.replace(' Guns', '');

                            var retrofitType;
                            if ([...str.matchAll(/\((\w+) on retrofit\)/)].length > 0) {
                                var sub = str.slice(str.search(/\((\w+) on retrofit\)/));
                                str = str.replace(sub, "").trim();
                                retrofitType = [...sub.matchAll(/\((\w+) on retrofit\)/)][0][1];
                            }

                            if (Object.keys(ALWikiApi.SHIP_TYPE_DICT).includes(str))
                                str = str.replace(new RegExp(str), ALWikiApi.SHIP_TYPE_DICT[str]) + " Guns";
                            
                            if (str == 'Anti-Air')
                                str = 'AA Guns';
                            
                            if (retrofitType !== undefined)
                                str = [str, retrofitType];
                            
                            return str;
                        }).flat();
                }),
            skins: root.find('.shiparttabbernew .azl_box_body').children('.tabber').children('div')
                .map(function() { 
                    return {
                        name: $(this).attr('title'),
                        image: self.host + $(this).children('div').children().first().children().first().attr('src')
                    } 
                }).toArray(),
            skills: root.find('th:contains("Skills")').parents('tbody').last().children('tr')
                .map(function(i) {
                    if (i == 0) return;
                
                    var row = $(this).children();
                    var type = "";
                    switch($(row.get(2)).attr('style').split(':').pop()) {
                        case 'Pink':
                            type = "Offense";
                            break;
                        case 'Gold':
                            type = "Support";
                            break;
                        case 'DeepSkyBlue':
                            type = "Defense"
                            break;
                    }
                    return {
                        name: $(row.get(2)).text(),
                        type: type,
                        description: $(row.get(3)).text(),
                    }
                }).toArray().filter(skill => skill.type.length > 0),
            quotes: vo.find('[title="English Server"]').find('tbody').find('tr')
                .map(function() {
                    var row = $(this).children('td');
                    return {
                        event: row.first().text(),
                        audio: $(row.get(1)).children().attr('href'),
                        transcript: $(row.get(2)).text()
                    }
                }).toArray().filter(row => row.event.length > 1),
            hasRetrofit: function() { return this.skins.some(skin => skin.name == "Retrofit") }
        }
    }

    async getEquipment(name) {
        var root = await this.query(name);
        return {
            name: root.find('tr').children().children().children().children().children().first().text(),
            tier: parseInt(root.find('tr').first().children().first().children().first().children().first().children().first().children().last().text().substr(1)),
            type: $(root.find('td:contains("Type")').get(1)).siblings().last().children().first().children().last().text(),
            icon: this.host + root.find('[data-file-width=256]').first().attr('src'),
            rarity: $(root.find('td:contains("Rarity")').get(1)).siblings().last().children().children().first().children().attr('title'),
            nation: $(root.find('td:contains("Nation")').get(1)).siblings().last().children().first().children().last().text(),
            usableWith: $(root.find('table').get(3)).children().children()
                .map(function(i) {
                    if (i == 0) return;
                    
                    var allow = "";
                    switch($($(this).children().get(2)).attr('style').split(';').pop().split(':').pop()) {
                        case "#88ff88":
                            allow = "Yes";
                            break;
                        case "#ff8888":
                            allow = "No";
                            break;
                        case "#ffff88": {
                            allow = $($(this).children().get(2)).children().children().text()
                            break;
                        }
                    }
                    return {
                        type: $($(this).children().get(1)).text(),
                        allow: allow
                    }
                }).toArray()  
        }
    }

    async getAllShips() {
        var root = await this.query('List of Ships by Image');
        var page = root.children().toArray().slice(3).filter(e => e.tagName != "P");

        var list = [];
        var mode = "";
        var self = this;
        page.forEach(item => {
            if (item.tagName == "H2")
                mode = $(item).children().first().text();

            if (item.tagName == "DIV")
                $(item).children('div').each(function() {
                    list.push({
                        id: $(this).children().first().children().first().children().last().children().first().text(),
                        type: $(this).children().first().children().first().children().first().children().first().attr('title').replace(/ \(\w+\)/g, ''),
                        name: $($(this).children().first().children().get(3)).children().first().children().first().attr('title'),
                        nation: $($(this).children().first().children().get(2)).children().first().children().first().attr('title'),
                        rarity: $($($(this).children().first().children().get(2)).children().get(1)).children().first().attr('title'),
                        image: self.host + $($(this).find('img').get(1)).attr('src'),
                        category: mode
                    });
                });
        });

        return list;
    }

    async getAllEquipmentIn(category) {
        var root = await this.query("List of " + category);
        var self = this;
        return root.find('table.wikitable.sortable').first().children('tbody').children()
            .map(function(i) {
                if (i < 2) return;
                
                var colorToRarity = {
                    Gainsboro: "Common",
                    PowderBlue: "Rare",
                    Plum: "Elite",
                    PaleGoldenrod: "Super Rare",
                    "linear-gradient(to right, #69FFAD, #7899F4 40%, #CC6D9D)": "Ultra Rare" 
                }

                var tierFunction = {
                    aux: () => $($(this).children('td').get(2)).text().split('').length - 1,
                    other: () => parseInt($(this).children().first().text().match(/T\d/g)[0].substr(1))
                }

                return {
                    name: $(this).children('td').first().text().replace(/ T\d/g, ''),
                    tier: (category.toLowerCase() != "auxiliary") ? tierFunction.aux() : tierFunction.other(),
                    icon: self.host + $($(this).children().get(1)).find('img').attr('src'),
                    rarity: colorToRarity[$($(this).children().get(1)).attr('style').split(';').pop().split(':').pop()]
                }
            }).toArray()
    }
}

ALWikiApi.SHIP_TYPE_DICT = {
    "AR": "Repair Ship",
    "ASW": "Anti-Submarine Warfare",
    "BB": "Battleship",
    "BBV": "Aviation Battleship",
    "BC": "Battlecruiser",
    "BM": "Monitor",
    "CA": "Heavy Cruiser",
    "CL": "Light Cruiser",
    "CV": "Aircraft Carrier",
    "CVL": "Light Aircraft Carrier",
    "DD": "Destroyer",
    "SS": "Submarine",
    "SSV": "Submarine Seaplane Carrier"
}