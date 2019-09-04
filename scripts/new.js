/* #region Editor Class */
class Editor extends EventTarget {
    constructor() {
        super();

        this.api = new ALWikiApi();

        this.loaded = {
            ships: [],
            equipment: {}
        }

        this.ship = null;
        this.loadouts = [];
        this.isPreview = false;
    }

    async init() {
        this.loaded.ships = (await this.api.getAllShips())
            .filter((obj, idx, self) => idx === self.findIndex((t) => t.name === obj.name));
        await this.loadEquipmentData('Auxiliary', 'Auxiliary Equipment');
        await this.loadEquipmentData('Anti-Submarine', 'ASW Equipment');
        this.dispatchEvent(new Event('onInitLoaded'));
    }

    async loadEquipmentData(alias, type = alias) {
        this.loaded.equipment[alias] = (await this.api.getAllEquipmentIn(type))
            .filter((obj, idx, self) => idx === self.findIndex((t) => t.name === obj.name));

        console.log("Loaded equipment for " + `%c${alias}`,
            'color:blue;');
    }

    async setShip(id = 0) {
        this.ship = await this.api.getShip(this.loaded.ships[id].name);

        if (!this.ship)
            return this.dispatchEvent(new CustomEvent('onError', { detail: { tried: `to get non-existent ship with id #${id}` } }));

        this.dispatchEvent(new CustomEvent('onChangeShip', { detail: { ship: this.ship, index: id } }));

        console.log("Loaded ship: " + `%c${this.ship.name}`,
            "color:blue;");
    }

    toggleDescriptionPreview() {
        this.isPreview = (this.isPreview) ? false : true;
        this.dispatchEvent(new CustomEvent('onTogglePreview', { detail: { state: this.isPreview } }));
    }

    addLoadout(name) {
        var loadout = { name: name, equipment: { 0: {}, 1: {}, 2: {}, 3: {}, 4: {} } }
        this.loadouts.push(loadout);
        this.dispatchEvent(new CustomEvent('onAddLoadout', { detail: { loadout: loadout, index: this.getLoadoutIndex(name) } }));
    }

    removeLoadout(name) {
        var removed = this.loadouts.splice(this.getLoadoutIndex(name), 1);
        
        if (!removed) 
            return this.dispatchEvent(new CustomEvent('onError', { detail: { tried: `to remove non-existent loadout "${name}"` } }));

        this.dispatchEvent(new CustomEvent('onRemoveLoadout', { detail: { loadout: removed[0] } }));
    }

    renameLoadout(name, toName) {
        var toRename = this.getLoadout(name);
        
        if (!toRename)
            return this.dispatchEvent(new CustomEvent('onError', { detail: { tried: `to rename non-existent loadout "${name}"` } }));

        toRename.name = toName;
        this.dispatchEvent(new CustomEvent('onRenameLoadout', { detail: { loadout: toRename, name: { from: name, to: toName } } }));
    }

    setEquipment(options) {
        var equipment;
        
        if (options.equipment.type && options.equipment.id)
            equipment = this.getEquipment(options.equipment.type, options.equipment.id);
        else if (options.equipment.name)
            equipment = options.equipment;
        
        if (!equipment)
            return this.dispatchEvent(new CustomEvent('onError', { detail: { tried: `to set non-existent equipment` } }));

        this.getLoadout(options.loadout).equipment[options.slot.index][options.slot.position] = equipment;
        this.dispatchEvent(new CustomEvent('onChangeEquipment', { detail: { slot: options.slot, equipment: equipment } }));
    }

    serialize() {
        return { ship: this.ship, loadouts: this.loadouts };
    }

    getLoadout(name) {
        return this.loadouts.find(loadout => loadout.name == name);
    } 

    getLoadoutIndex(name) {
        return this.loadouts.map(loadout => loadout.name).indexOf(name);
    }

    getLoadoutSlot(name, slot) {
        return this.getLoadout(name).equipment[slot];
    }

    getEquipment(type, id) {
        return this.loaded.equipment[type][id];
    }
}
/* #endregion */

var EDITOR;
$(document).ready(async function () {
    const converter = new showdown.Converter();
    converter.setFlavor('github');

    $('.start-info p').text("Loading");

    /* #region Editor */
    EDITOR = new Editor();

    console.log("%c AL Guide Creator" + `%c (api version ${EDITOR.api.version})`,
        'font-size: 24px; font-weight: bold; color: rgb(30, 64, 120)',
        '');

    console.log("Please contact " + "@LeNitrous %o" + " on Twitter for any issues!",
        'https://twitter.com/LeNitrous');


    EDITOR.addEventListener('onInitLoaded', function () {
        $('.resume .header .name').text('Select a ship...');
    });

    EDITOR.addEventListener('onTogglePreview', function (event) {
        $(".text-editor")[(event.detail.state) ? "hide" : "show"]();
        $(".text-preview")
            [(!event.detail.state) ? "hide" : "show"]()
            .empty();
        $(".description.text-preview").append(converter.makeHtml($(".description.text-editor").val()));
        $(".barrage.text-preview").append(converter.makeHtml($(".barrage.text-editor").val()));
    });

    EDITOR.addEventListener('onChangeShip', function (event) {
        const ship = event.detail.ship;

        // Display the editor once we have a ship
        setEditorVisibility(true);

        // Update the ship's details
        $('.resume .header div.retrofit')[ (ship.hasRetrofit()) ? "show" : "hide" ]();

        $('.resume .header .character').css('background-image', `url(${ship.icon})`).show();
        $('.resume .header .nation').css('background-image', `url('assets/emblem/${ship.nation}.png')`);
        $('.resume .header .type').css('background-image', `url('assets/type/${ship.type[0]}.png')`);
        $('.resume .header .name').text(ship.name);
        $('.resume .header .rarity').text(ship.rarity);
        $('.resume .details .skill').each(function (i) {
            const skill = ship.skills[i];

            if (!skill) {
                $(this)
                    .attr('data-skill-type', '???')
                    .empty();
                return;
            }

            $(this).find('.name').text(skill.name);
            $(this).find('.desc').text(skill.description);
            $(this).attr('data-skill-type', skill.type);
        });

        // Clear loadouts so we wouldn't get any funky ones
        EDITOR.loadouts.map(loadout => loadout.name)
            .forEach(loadout => EDITOR.removeLoadout(loadout))

        EDITOR.addLoadout("Default");

        // Equipment list loads as needed
        [...new Set(ship.equips.flat())]
            .forEach((type, idx) => {
                if (EDITOR.loaded.equipment[type]) return;
        
                setTimeout(async function() {
                    await EDITOR.loadEquipmentData(type);
                }, idx * 750);
            });
    });

    EDITOR.addEventListener('onChangeEquipment', function (event) {
        const current = $('select.equipment-header').val();
        const equip = event.detail.equipment;
        $(`.loadout-tab[data-loadout=${current}] .equipment[data-slot-idx=${event.detail.slot.index}][data-slot-pos=${event.detail.slot.position}]`).find('.icon').css('background-image', `url(${equip.icon})`);
        $(`.loadout-tab[data-loadout=${current}] .equipment[data-slot-idx=${event.detail.slot.index}][data-slot-pos=${event.detail.slot.position}]`).find('.name').text(equip.name);
        $(`.loadout-tab[data-loadout=${current}] .equipment[data-slot-idx=${event.detail.slot.index}][data-slot-pos=${event.detail.slot.position}]`).find('.type').text(equip.type);
    });

    EDITOR.addEventListener('onAddLoadout', function (event) {
        const name = event.detail.loadout.name;
        $('input.equipment-header').val("");
        $('select.equipment-header')
            .append(new Option(name, name))
            .val(name)
            .trigger('change');

        $('.loadout-container').append(`<div class="loadout-tab" data-loadout="${name}"></div>`);

        for (var slot = 0; slot < 5; slot++) {
            var type = (slot > 2) ? 'Auxiliary' : EDITOR.ship.equips[slot];
            $(`.loadout-tab[data-loadout="${name}"]`).append(`
                <div class="row middle-xs end-xs">
                    <p class="editor-equipment-type" data-slot-idx="${slot}">${type}</p>
                    <div class="col-xs-1">
                        <a class="slot-add" data-slot-idx="${slot}" href="javascript:void(0)" title="Add Slot">
                            <i class="fas fa-plus-square"></i>
                        </a>
                    </div>
                </div>
                <div class="loadout-slot-container" data-slot-idx="${slot}" data-slot-type="${type}"></div>
            `);
        }
    });

    EDITOR.addEventListener('onRemoveLoadout', function (event) {
        const name = event.detail.loadout.name;
        $(`.loadout-tab[data-loadout=${name}]`).remove();
        $(`select.equipment-header option[value="${name}"]`).remove()

        if (EDITOR.loadouts[0])
            $('select.equipment-header')
                .val(EDITOR.loadouts[0].name)
                .trigger('change');
    });

    EDITOR.addEventListener('onRenameLoadout', function (event) {
        const from = event.detail.name.from;
        const to = event.detail.name.to;
        $('input.equipment-header').val("");
        $(`select.equipment-header option[value="${from}"]`)
            .attr('value', to)
            .text(to);
    });

    EDITOR.addEventListener('onError', function (event) {
        console.error(`Tried ${event.detail.tried}.`);
    });

    await EDITOR.init();

    $('.start-info p').text("Pick a ship by clicking the header above to get started.");
    /* #endregion */

    /* #region UI */
    $('select.equipment-header').on('change', function () {
        var loadout = EDITOR.getLoadout($(this).val());

        $('.loadout-tab').each(function () {
            var name = $(this).attr('data-loadout');
            
            if (name != loadout.name)
                $(this).hide();
            else
                $(this).show();
        });
    });

    $('#preview-toggle').on('click', function () {
        EDITOR.toggleDescriptionPreview();
    });

    $('#loadout-add').on('click', function () {
        EDITOR.addLoadout($('input.equipment-header').val().trim());
    });

    $('#loadout-remove').on('click', function () {
        if (EDITOR.loadouts.length <= 1) return;
        EDITOR.removeLoadout($('select.equipment-header').val());
    });

    $('#loadout-rename').on('click', function () {
        EDITOR.renameLoadout($('select.equipment-header').val(), $('input.equipment-header').val().trim());
    });

    $('#state-save').on('click', function () {
        if (!EDITOR.ship) return;
        
        var output = EDITOR.serialize();
        output.description = $(".description.text-editor").val();
        output.barrage = $(".description.text-editor").val();
        output.retrofitted = $("input.retrofit").is(":checked");

        var blob = new Blob([ JSON.stringify(output) ], {type: "application/json;charset=utf-8"});
        saveAs(blob, `${EDITOR.ship.name}.json`);
    });

    $('#state-load').on('click', function () {

    });

    $('.loadout-container').on('click', '.slot-add', function () {
        var current = $('select.equipment-header').val();
        var slot = $(this).attr('data-slot-idx');
        var container = $(`.loadout-tab[data-loadout=${current}] .loadout-slot-container[data-slot-idx=${slot}]`);

        EDITOR.getLoadout(current).equipment[slot][container.children().length] = null;

        $(`.loadout-tab[data-loadout=${current}] .loadout-slot-container[data-slot-idx=${slot}]`).append(`
            <div class="row middle-xs">
                <div class="equipment editor-equipment-select" data-slot-idx="${container.attr('data-slot-idx')}" data-slot-pos="${container.children().length}" data-slot-type="${container.attr('data-slot-type')}">
                    <div class="row middle-xs">
                        <div class="icon"></div>
                        <div class="col-xs autoheight">
                            <p class="name"></p>
                        </div>
                        <div class="col-xs-3 autoheight">
                            <p class="type"></p>
                        </div>
                    </div>
                </div>
                <a class="slot-remove" href="javascript:void(0)" title="Remove Selected Loadout">
                    <i class="fas fa-minus-square"></i>
                </a>
            </div>
        `);
    });

    $('.loadout-container').on('click', '.editor-equipment-select', function () {
        var type = $(this).data('slot-type').split(';');

        if (type[0] == "???" || !$('select.equipment-header').val()) return;

        type.forEach(t => {
            EDITOR.loaded.equipment[t].forEach((item, idx) => {
                $('.modal .modal-content .body').append(`
                    <div class="equipment equipment-selectable" data-slot-type="${t}" data-slot-idx="${$(this).data('slot-idx')}" data-slot-pos="${$(this).data('slot-pos')}" data-idx="${idx}">
                        <div class="row fullheight middle-xs">
                            <div class="icon" style="background-image:url('${item.icon}')"></div>
                            <div class="col-xs autoheight">
                                <p class="name">${item.name}</p>
                            </div>
                        </div>
                    </div>
                `);
            });
        });
        $('.modal').show();
    });

    $('.loadout-container').on('click', '.slot-remove', function () {
        var loadout = $('select.equipment-header').val();
        var main = $(this).siblings('.editor-equipment-select');
        var slot = main.attr('data-slot-idx');
        var pos = main.attr('data-slot-pos');

        var array = Object.values(EDITOR.getLoadout(loadout).equipment[slot]);
        array.splice(pos, 1);
        EDITOR.getLoadout(loadout).equipment[slot] = Object.assign({}, array);
        main.parent().remove();

        $(`.editor-equipment-select[data-slot-idx="${slot}"]`).each(function (i) {
            $(this).attr('data-slot-pos', i);
        });
    });

    $('.modal .modal-content .body').on('click', '.equipment-selectable', function () {
        var type = $(this).attr('data-slot-type');
        var slot = $(this).attr('data-slot-idx');
        var pos = $(this).attr('data-slot-pos');
        var idx = parseInt($(this).data('idx'));
        var loadout = $('select.equipment-header').val();

        EDITOR.setEquipment({
            loadout: loadout,
            slot: {
                index: slot,
                position: pos
            },
            equipment: {
                type: type,
                id: idx
            }
        });

        $('.modal .modal-content .close').trigger('click');
    });

    $('.header.editor .name').click('on', function() {
        if (EDITOR.ship && !confirm('Changing ship will undo your progress. Proceed?')) return;

        EDITOR.loaded.ships.forEach((ship, idx) => {
            $('.modal .modal-content .body').append(`
                <div class="ship-selectable" data-idx="${idx}" style="background-image:url('${ship.image}')">
                    <p>${ship.name}</p>
                </div>
            `)
        });
        $('.modal').show();
    });

    $('.modal .modal-content .body').on('click', '.ship-selectable', function () {
        setEditorVisibility(false, 'Loading');
        EDITOR.setShip(parseInt($(this).data('idx')));
        $('.modal .modal-content .close').trigger('click');
    });

    $('.modal .modal-content .close').click(function () {
        $('.modal').hide();
        $('.modal .modal-content .body').empty();
    });
    /* #endregion */

    function setEditorVisibility(state, message) {
        $('.resume .body')[ (state) ? "show" : "hide" ]();
        $('.start-info')[ (!state) ? "show" : "hide" ]();

        if (message) $('.start-info p').text(message);
    }
});