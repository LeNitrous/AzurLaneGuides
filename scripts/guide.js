$(document).ready(async function() {
    const converter = new showdown.Converter();
    converter.setFlavor('github');

    var ship = getParameter("ship");

    if (!ship || ship.length === 0)
        hideBody();

    var data;
    
    try {
        data = await $.ajax({
            url: `/AzurLaneGuides/guides/${ship}.json`,
            dataType: 'json'
        });
    }
    catch (error) {
        return hideBody();
    }      

    $('.character').css('background-image', `url(${data.ship.skins[0].image})`);
    $('.resume .header .character').css('background-image', `url(${data.ship.icon})`);
    $('.resume .header .nation').css('background-image', `url('assets/emblem/${data.ship.nation}.png')`);
    $('.resume .header .type').css('background-image', `url('assets/type/${data.ship.type}.png')`);
    $('.resume .header .name').text(data.ship.name)
    $('.resume .header .rarity').text(data.ship.rarity)

    $('.resume .details .description').append(converter.makeHtml(data.description));

    data.loadouts.forEach((preset, index) => $('.resume .details select').append(`<option value="${index}">${preset.name}</option>`));

    $('.resume .details .equipment').each(function(i) {
        const preset = data.loadouts[0];
        const equip = preset.equipment[i];
        $(this).find('.icon').css('background-image', `url(${equip.icon})`);
        $(this).find('.name').text(equip.name);
        $(this).find('.type').text(equip.type);
    });

    $('.resume .details .skill').each(function(i) {
        const skill = data.ship.skills[i];

        if (!skill) return;

        $(this).find('.name').text(skill.name);
        $(this).find('.desc').text(skill.description);
        $(this).attr('data-skill-type', skill.type);
    });

    function hideBody() {
        $('.resume .body').hide();
        $('.start-info').show();
    }

    function getParameter(name, url) {
        if (!url) url = window.location.href;
        name = name.replace(/[\[\]]/g, '\\$&');
        var regex = new RegExp('[?&]' + name + '(=([^&#]*)|&|#|$)'),
            results = regex.exec(url);
        if (!results) return null;
        if (!results[2]) return '';
        return decodeURIComponent(results[2].replace(/\+/g, ' '));
    }
});
