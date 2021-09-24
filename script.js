var layout = { layers: [] };

const ROWS = 5;
const COLS = 17;
const LAYER_REF_OFFSET = 1;  // where in the key list to show layer refs


function createForm() {
    let selectTemplate = document.getElementById("select-template");
    for (let r = 1; r <= ROWS; ++r) {
        for (let c = 1; c <= COLS; ++c) {
            const keyId = "k-" + r + "-" + c;
            let td = document.getElementById(keyId);
            if (!td) {
                continue;
            }
            let select = selectTemplate.cloneNode(true);
            select.addEventListener("input", function(evt) {
                const layerIndex = document.getElementById("select-layer").selectedIndex;
                const layerKeymap = layout.layers[layerIndex].keymap;
                layerKeymap[keyId] = evt.target.value;
            });
            td.appendChild(select);
        }
    }

    selectTemplate.parentNode.removeChild(selectTemplate);
}


function updateLayout(newLayout) {
    const layerSelect = document.getElementById("select-layer");

    // first remove all the current layers
    while (layout.layers.length > 0) {
        removeLayer(layout.layers.length - 1);
    }

    // now add the new layers
    newLayout.layers.forEach(layer => {
        addLayer(layer.name, layer.keymap);
    });
    layerSelect.value = layerSelect.firstChild.value;
    selectLayer(0);
}


function selectLayer(index) {
    const keymap = layout.layers[index].keymap;

    for (let r = 1; r <= ROWS; ++r) {
        for (let c = 1; c <= COLS; ++c) {
            const keyId = "k-" + r + "-" + c;
            const td = document.getElementById(keyId);
            if (!td) {
                continue;
            }

            const select = td.firstChild;
            if (keyId in keymap) {
                select.value = keymap[keyId];
            } else {
                select.value = "_______";
            }
        }
    }
}


function handleRemoveLayer() {
    const select = document.getElementById("select-layer");

    if (select.children.length <= 1) {
        window.alert("Cannot remove last layer.");
        return;
    }

    const layerIndex = select.selectedIndex;
    if (window.confirm("Remove layer '" + layout.layers[layerIndex].name + "'?")) {
        removeLayer(layerIndex);
        select.value = select.firstChild.value;
        selectLayer(0);
    }
}


function handleAddLayer() {
    const layerName = window.prompt("Enter layer name:");
    if (!layerName || layerName == "") {
        return;
    }

    // just assume that the name is valid and unique for the C export
    addLayer(layerName, {});
}


function handleRenameLayer() {
    const select = document.getElementById("select-layer");
    const layerIndex = select.selectedIndex;

    const layerName = window.prompt("Enter layer name:");
    if (!layerName || layerName == "") {
        return;
    }

    layout.layers[layerIndex].name = layerName;
    select.children[layerIndex].innerText = layerName;
    select.children[layerIndex].value = layerName;
    select.value = layerName;
}


function removeLayer(index) {
    // remove from the select
    const select = document.getElementById("select-layer");
    select.removeChild(select.children[index]);

    // remove from the layout
    layout.layers.splice(index, 1);

    // remove from the key options
    for (let r = 1; r <= ROWS; ++r) {
        for (let c = 1; c <= COLS; ++c) {
            const keyId = "k-" + r + "-" + c;
            const td = document.getElementById(keyId);
            if (!td) {
                continue;
            }

            const select = td.firstChild;
            select.removeChild(select.children[index + LAYER_REF_OFFSET]);
        }
    }
    // we'll just ignore any "dangling" keys that reference this layer
}


function addLayer(layerName, keymap) {
    // add to the select
    const select = document.getElementById("select-layer");
    const option = document.createElement("option");
    option.innerText = layerName;
    option.value = layerName;
    select.appendChild(option);

    // add to the layout
    layout.layers.push({
        name: layerName,
        keymap: keymap
    });

    // add to the key options
    const keyOption = document.createElement("option");
    keyOption.innerText = "[" + layerName + "]";
    keyOption.value = "[" + layerName + "]";
    const numLayers = layout.layers.length;
    for (let r = 1; r <= ROWS; ++r) {
        for (let c = 1; c <= COLS; ++c) {
            const keyId = "k-" + r + "-" + c;
            const td = document.getElementById(keyId);
            if (!td) {
                continue;
            }

            const select = td.firstChild;
            select.insertBefore(
                keyOption.cloneNode(true),
                select.children[numLayers + LAYER_REF_OFFSET - 1]
            );
        }
    }
}


function loadLayout() {
    const files = document.getElementById("file-input").files;
    if (files.length == 0) {
        window.alert("Choose a file first.");
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        // we'll just trust that this file is correctly formatted
        const contents = e.target.result;
        newLayout = JSON.parse(contents);
        updateLayout(newLayout);
        window.alert("Layout loaded successfully.");
    };
    reader.readAsText(files[0]);
}


function saveLayout() {
    let json = JSON.stringify(layout, null, 2);
    let filename = "layout.json";
    let file = new Blob([json], {type: "application/json"});

    let a = document.createElement("a");
    let url = URL.createObjectURL(file);
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(
        function() {
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        },
        0
    );
}


function exportLayout() {
    let content = "// Generated using Redox Layout Editor.\n" +
        "// https://github.com/tilleyd/redox-layout-editor\n" +
        "#include QMK_KEYBOARD_H\n\n";

    // define layers
    for (i in layout.layers) {
        const layer = layout.layers[i];
        content += "#define _" + layer.name + " " + i + "\n";
    }
    content += "enum custom_keycodes {\n";
    for (i in layout.layers) {
        const layer = layout.layers[i];
        if (i == 0) {
            content += "    " + layer.name + " = SAFE_RANGE,\n";
        } else {
            content += "    " + layer.name + ",\n";
        }
    }
    content += "};\n\n";

    // create the keymap
    content += "const uint16_t PROGMEM keymaps[][MATRIX_ROWS][MATRIX_COLS] = {\n\n";
    for (i in layout.layers) {
        const layer = layout.layers[i];
        content += "    [_" + layer.name + "] = LAYOUT(\n";

        for (let r = 1; r <= ROWS; ++r) {
            for (let c = 1; c <= COLS; ++c) {
                const keyId = "k-" + r + "-" + c;
                const td = document.getElementById(keyId);
                if (!td) {
                    continue;
                }

                if (c == 1) {
                    content += "        ";
                } else {
                    content += ", ";
                }

                let value = "_______";
                if (keyId in layer.keymap) {
                    value = layer.keymap[keyId];
                }
                if (value[0] == "[") {
                    let layerName = value.substr(1, value.length - 2);
                    value = "MO(_" + layerName + ")";
                }
                content += value;
            }
            if (r < ROWS) {
                content += ",\n";
            } else {
                content += "\n";
            }
        }

        content += "    ),\n\n";
    }

    content += "};\n";

    let filename = "keymap.c";
    let file = new Blob([content], {type: "text/plain"});

    let a = document.createElement("a");
    let url = URL.createObjectURL(file);
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(
        function() {
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        },
        0
    );
}


window.onload = function() {
    createForm();
    updateLayout({
        layers: [
            {
                name: "BASE",
                keymap: {}
            }
        ]
    });
}
// window.onbeforeunload = function() {
//     return "Are you sure you want to leave? Unsaved changes will be lost.";
// }
