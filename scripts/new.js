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
        var loadout = { name: name, equipment: {} }
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
        var equipment = this.getEquipment(options.equipment.type, options.equipment.id);
        
        if (!equipment)
            return this.dispatchEvent(new CustomEvent('onError', { detail: { tried: `to set non-existent ${options.equipment.type} equipment with id #${options.equipment.id} ` } }));

        this.getLoadout(options.loadout).equipment[options.slot] = equipment;
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

            if (!skill) return;

            $(this).find('.name').text(skill.name);
            $(this).find('.desc').text(skill.description);
            $(this).attr('data-skill-type', skill.type);
        });

        // Clear loadouts so we wouldn't get any funky ones
        EDITOR.loadouts.map(loadout => loadout.name)
            .forEach(loadout => EDITOR.removeLoadout(loadout))

        EDITOR.addLoadout("Default");

        // Update the slot types
        for (var slot = 0; slot < 5; slot++) {
            var type = ship.equips[slot];
            if (type) {
                $(`.editor-equipment-type[data-slot-idx=${slot}]`).text(type.join(' / '));
                $(`.equipment[data-slot-idx=${slot}]`).data('slot-type', type.join(';'));
            }
            else if (slot > 2 && (ship.type == "Destroyer" || ship.type == "Light Cruiser"))
                $(`.equipment[data-slot-idx=${slot}]`).attr('data-slot-type', 'Auxiliary;Anti-Submarine');
            else
                $(`.equipment[data-slot-idx=${slot}]`).attr('data-slot-type', 'Auxiliary');
        }

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
        const equip = event.detail.equipment;
        $(`.equipment[data-slot-idx=${event.detail.slot}]`).find('.icon').css('background-image', `url(${equip.icon})`);
        $(`.equipment[data-slot-idx=${event.detail.slot}]`).find('.name').text(equip.name);
        $(`.equipment[data-slot-idx=${event.detail.slot}]`).find('.type').text(equip.type);
    });

    EDITOR.addEventListener('onAddLoadout', function (event) {
        const name = event.detail.loadout.name;
        $('input.equipment-header').val("");
        $('select.equipment-header')
            .append(new Option(name, name))
            .val(name)
            .trigger('change');
    });

    EDITOR.addEventListener('onRemoveLoadout', function (event) {
        const name = event.detail.loadout.name;
        $(`select.equipment-header option[value="${name}"]`).remove()
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
        for (var slot = 0; slot < 5; slot++) {
            var equip = EDITOR.getLoadout($(this).val()).equipment[slot];
            
            $(`.equipment[data-slot-idx=${slot}]`).find('.icon').css('background-image', `url(${(equip) ? equip.icon : ""})`);
            $(`.equipment[data-slot-idx=${slot}]`).find('.name').text((equip) ? equip.name : "");
            $(`.equipment[data-slot-idx=${slot}]`).find('.type').text((equip) ? equip.type : "");
        }
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

    $('#state-save').on('click', function() {
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

    $('.editor-equipment-select').click(function () {
        var type = $(this).data('slot-type').split(';');

        if (type[0] == "???" || !$('select.equipment-header').val()) return;

        type.forEach(t => {
            EDITOR.loaded.equipment[t].forEach((item, idx) => {
                $('.modal .modal-content .body').append(`
                    <div class="equipment equipment-selectable" data-slot-type="${t}" data-slot-idx="${$(this).data('slot-idx')}" data-idx="${idx}">
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

    $('.modal .modal-content .body').on('click', '.equipment-selectable', function () {
        var type = $(this).data('slot-type');
        var slot = $(this).data('slot-idx');
        var idx = parseInt($(this).data('idx'));

        EDITOR.setEquipment({
            loadout: $('select.equipment-header').val(),
            slot: slot,
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