var MyVars = {
    keepTrying: true
};

$(document).ready(function () {
    //debugger;
    // check URL params
    var url = new URL(window.location.href);
    var client_id = url.searchParams.get("client_id");
    if (client_id) {
        $("#client_id").val(client_id);
    }
    var client_secret = url.searchParams.get("client_secret");
    if (client_secret) {
        $("#client_secret").val(client_secret);
    }

    $("#createBucket").click(function (evt) {
        // adamnagy_2017_06_14
        var bucketName = $("#bucketName").val()
        var bucketType = $("#bucketType").val()
        $.ajax ({
            url: '/dm/buckets',
            type: 'POST',
            contentType: 'application/json',
            dataType: 'json',
            data: JSON.stringify({
                bucketName: bucketName,
                bucketType: bucketType
            })
        }).done (function (data) {
            console.log('Response' + data);
            showProgress("Bucket created", "success")
            $('#appBundlesTree').jstree(true).refresh()
        }).fail (function (xhr, ajaxOptions, thrownError) {
            console.log('Bucket creation failed!')
            showProgress("Could not create bucket", "failed")
        }) ;
    });

    // AppBundles

    $("#appbundlesTree_refresh").click(function (evt) {
        $("#appbundlesTree").jstree(true).refresh()
    });

    $("#appbundlesTree_add").click(function (evt) {
        createItem('appbundles');
    });

    $("#appbundlesTree_delete").click(function (evt) {
        deleteItem('appbundles');
    });

    // Activities

    $("#activitiesTree_refresh").click(function (evt) {
        $("#activitiesTree").jstree(true).refresh()
    });

    $("#activitiesTree_add").click(function (evt) {
        createItem('activities');
    });

    $("#activitiesTree_delete").click(function (evt) {
        deleteItem('activities');
    });

    function uuidv4() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    function uploadChunks (file){
        var loaded = 0;
        var step = 2 * 1024*1024; // 2 MB suggested
        var total = file.size;  // total size of file
        var start = 0;          // starting position
        var reader = new FileReader();
        var blob = file.slice(start,step); //a single chunk in starting of step size
        reader.readAsArrayBuffer(blob);   // reading that chunk. when it read it, onload will be invoked

        var folderId = MyVars.selectedNode.id;
        var fileName = file.name;
        var sessionId = uuidv4();

        reader.onload = function(e){
            //var d = {file:reader.result}
            var currentStart = start
            var currentEnd = start + e.loaded - 1;
            start = currentEnd + 1
            var res = reader.result
            var range = 'bytes ' + currentStart + "-" + currentEnd + "/" + total

            console.log("uploadChunks >> ajax: sessionId = " + sessionId + ", range = " + range);
            $.ajax({
                url:"/dm/chunks",
                type:"POST",
                headers: {
                    'Content-Type': 'application/octet-stream',
                    'x-file-name': fileName,
                    'id': folderId,
                    'sessionid': sessionId,
                    'range': range
                },
                processData: false,
                data:res                     // d is the chunk got by readAsBinaryString(...)
            }).done(function(r){           // if 'd' is uploaded successfully then ->
                //$('.record_reply_g').html(r);   //updating status in html view

                loaded += step;                 //increasing loaded which is being used as start position for next chunk
                //$('.upload_rpogress').html((loaded/total) * 100);

                if(loaded <= total){            // if file is not completely uploaded
                    blob = file.slice(loaded,loaded+step);  // getting next chunk
                    reader.readAsArrayBuffer(blob);        //reading it through file reader which will call onload again. So it will happen recursively until file is completely uploaded.
                } else {                       // if file is uploaded completely
                    loaded = total;            // just changed loaded which could be used to show status.
                    // We're finished
                    console.log("uploadChunks >> done");
                    showProgress("File uploaded", "success");
                    $("#forgeUploadHidden").val('');
                    $('#appBundlesTree').jstree(true).refresh()
                }
            }).fail (function (error) {
                console.log("uploadChunks >> fail");
                showProgress("Upload failed", "failed");
                $("#forgeUploadHidden").val('');
            })
        };
    }

    $("#forgeUploadHidden").change(function(evt) {

        showProgress("Uploading file... ", "inprogress");

        uploadChunks(this.files[0]);

        return;


        var data = new FormData () ;
        var fileName = this.value;
        var that = this

        data.append (0, this.files[0]) ;
        $.ajax ({
            url: '/dm/files',
            type: 'POST',
            headers: { 'x-file-name': fileName, 'id': MyVars.selectedNode.id },
            data: data,
            cache: false,
            processData: false, // Don't process the files
            contentType: false, // Set content type to false as jQuery will tell the server its a query string request
            complete: null
        }).done (function (data) {
            console.log('Uploaded file "' + data.fileName + '" with urn = ' + data.objectId);

            showProgress("File uploaded", "success");
            $('#appBundlesTree').jstree(true).refresh()

            // Clear selected files list
            that.value = ""
        }).fail (function (xhr, ajaxOptions, thrownError) {
            console.log(fileName + ' upload failed!') ;
            showProgress("Upload failed", "failed");
        }) ;
    });

    var upload = $("#uploadFile").click(function(evt) {
        evt.preventDefault();
        $("#forgeUploadHidden").trigger("click");
    });

    var auth = $("#authenticate")
    auth.click(function () {
        // Get the tokens
        get2LegToken(function(token) {
            var auth = $("#authenticate");

            MyVars.token2Leg = token;

            auth.html('You\'re logged in');

            // Fill the tree AppBundle and Activity items
            prepareItemsTree('appbundles');
            prepareItemsTree('activities');
        });
    });

    $('#progressInfo').click(function() {
        MyVars.keepTrying = false;
        showProgress("Translation stopped", 'failed');
    });
}); // $(document).ready

function base64encode(str) {
    var ret = "";
    if (window.btoa) {
        ret = window.btoa(str);
    } else {
        // IE9 support
        ret = window.Base64.encode(str);
    }

    // Remove ending '=' signs
    // Use _ instead of /
    // Use - insteaqd of +
    // Have a look at this page for info on "Unpadded 'base64url' for "named information" URI's (RFC 6920)"
    // which is the format being used by the Model Derivative API
    // https://en.wikipedia.org/wiki/Base64#Variants_summary_table
    var ret2 = ret.replace(/=/g, '').replace(/[/]/g, '_').replace(/[+]/g, '-');

    console.log('base64encode result = ' + ret2);

    return ret2;
}

function logoff() {
    $.ajax({
        url: '/user/logoff',
        success: function (oauthUrl) {
            location.href = oauthUrl;
        }
    });
}

function get2LegToken(callback) {

    if (callback) {
        var client_id = $('#client_id').val();
        var client_secret = $('#client_secret').val();
        $.ajax({
            url: '/user/token',
            data: {
                client_id: client_id,
                client_secret: client_secret
            },
            success: function (data) {
                MyVars.token2Leg = data.token;
                console.log('Returning new 3 legged token (User Authorization): ' + MyVars.token2Leg);
                callback(data.token, data.expires_in);
                showProgress()
            },
            error: function(err, text) {
                showProgress(err.responseText, 'failed');
            }
        });
    } else {
        console.log('Returning saved 3 legged token (User Authorization): ' + MyVars.token2Leg);

        return MyVars.token2Leg;
    }
}

// http://stackoverflow.com/questions/4068373/center-a-popup-window-on-screen
function PopupCenter(url, title, w, h) {
    // Fixes dual-screen position                         Most browsers      Firefox
    var dualScreenLeft = window.screenLeft != undefined ? window.screenLeft : screen.left;
    var dualScreenTop = window.screenTop != undefined ? window.screenTop : screen.top;

    var width = window.innerWidth ? window.innerWidth : document.documentElement.clientWidth ? document.documentElement.clientWidth : screen.width;
    var height = window.innerHeight ? window.innerHeight : document.documentElement.clientHeight ? document.documentElement.clientHeight : screen.height;

    var left = ((width / 2) - (w / 2)) + dualScreenLeft;
    var top = ((height / 2) - (h / 2)) + dualScreenTop;
    var newWindow = window.open(url, title, 'scrollbars=yes, width=' + w + ', height=' + h + ', top=' + top + ', left=' + left);

    // Puts focus on the newWindow
    if (window.focus) {
        newWindow.focus();
    }
}


function isArraySame(arr1, arr2) {
    // If both are undefined or has no value
    if (!arr1 && !arr2)
        return true;

    // If just one of them has no value
    if (!arr1 || !arr2)
        return false;

    return (arr1.sort().join(',') === arr2.sort().join(','));
}

/////////////////////////////////////////////////////////////////
// AppBundles Tree / #appBundlesTree
// Shows the A360 hubs, projects, folders and files of
// the logged in user
/////////////////////////////////////////////////////////////////

function showItemsInfo(id, nickName, alias, type) {
    $.ajax({
        url: `/da/${type}/info`,
        data: {
            id: id,
            nickName: nickName,
            alias: alias
        },
        success: function (data) {
            $(`#${type}Info`).val(JSON.stringify(data, null, 2));
        },
        error: function (err) {
            $(`#${type}Info`).val(JSON.stringify(err.responseJSON, null, 2));
        }
    });
}

function deleteItem(type) {
    var nodeId = $(`#${type}Tree`).jstree('get_selected');
    var node = $(`#${type}Tree`).jstree(true).get_node(nodeId);
    $.ajax({
        url: `/da/${type}/${encodeURIComponent(node.id)}`,
        type: 'DELETE',
        data: {
            nickName: node.original.nickName,
            alias: node.original.alias
        },
        success: function (data) {
            $(`#${type}Info`).val(JSON.stringify(data, null, 2));

            // Remove node
            //var parent = $(`#${type}Tree`).jstree().get_node(node.parent);
            var nextNode = $(`#${type}Tree`).jstree().get_next_dom(node.id);
            $(`#${type}Tree`).jstree().delete_node([node.id]);
            $(`#${type}Tree`).jstree('select_node', nextNode);
        },
        error: function (err) {
            $(`#${type}Info`).val(JSON.stringify(err.responseJSON, null, 2));
        }
    });
}

function createItem(type) {
    var nodeId = $(`#${type}Tree`).jstree('get_selected');
    var node = $(`#${type}Tree`).jstree(true).get_node(nodeId);

    var data = {
        id: node.id,
        nickName: node.original.nickName,
        alias: node.original.alias
    }

    if (node.type === 'version') {
        // get alias name from user
        var alias = prompt("Name to use for the alias", "");
        data.alias = alias;
    }

    $.ajax({
        url: `/da/${type}`,
        type: 'POST',
        data: JSON.stringify(data),
        dataType: 'json',
        contentType: 'application/json',
        success: function (data) {
            $(`#${type}Info`).val(JSON.stringify(data, null, 2));
            
            // Refresh the node's chidren 
            $(`#${type}Tree`).jstree(true).refresh_node(node.id); 
        },
        error: function (err) {
            $(`#${type}Info`).val(JSON.stringify(err.responseJSON, null, 2));
        }
    });
}

function prepareItemsTree(type) {
    console.log("prepareItemsTree");
    $(`#${type}Tree`).jstree({
        'core': {
            'themes': { "icons": true },
            'check_callback': true, // make it modifiable
            'data': {
                "url": `/da/${type}/treeNode`,
                "dataType": "json",
                "data": function (node) {
                    return {
                        "id": node.id
                    };
                }
            }
        },
        "ui": {
            "select_limit": 1
        },
        'types': {
            'default': {
                'icon': 'glyphicon glyphicon-cloud'
            },
            'folder': {
                'icon': 'glyphicon glyphicon-folder-open'
            },
            'item': {
                'icon': 'glyphicon glyphicon-briefcase'
            },
            'version': {
                'icon': 'glyphicon glyphicon-time'
            },
            'alias': {
                'icon': 'glyphicon glyphicon-tag'
            }
        },
        "plugins": ["types"] // let's not use sort or state: , "state" and "sort"],
    }).bind("select_node.jstree", function (evt, data) {
        console.log("select_node.jstree");

        let node = data.node;
        if (node.type === 'alias') {
            var itemNode = $(`#${type}Tree`).jstree(true).get_node(node.parents[1]);
            showItemsInfo(node.id, itemNode.original.nickName, itemNode.original.alias, type);
        } else if (node.type === 'item') {
            // Shared items have "alias" property 
            if (node.original.alias) {
                showItemsInfo(node.id, node.original.nickName, node.original.alias, type);
            }
        }
    });
}

/////////////////////////////////////////////////////////////////
// Other functions
/////////////////////////////////////////////////////////////////

function showProgress(text, status) {
    var progressInfo = $('#progressInfo');
    var progressInfoText = $('#progressInfoText');
    var progressInfoIcon = $('#progressInfoIcon');

    var oldClasses = progressInfo.attr('class');
    var newClasses = "";
    var newText = text;

    if (status === 'failed') {
        newClasses = 'btn btn-danger';
    } else if (status === 'inprogress' || status === 'pending') {
        newClasses = 'btn btn-warning';
        newText += " (Click to stop)";
    } else if (status === 'success') {
        newClasses = 'btn btn-success';
    } else {
        newClasses = 'btn btn-info';
        newText = "Progress info"
    }

    // Only update if changed
    if (progressInfoText.text() !== newText) {
        progressInfoText.text(newText);
    }

    if (oldClasses !== newClasses) {
        progressInfo.attr('class', newClasses);

        if (newClasses === 'btn btn-warning') {
            progressInfoIcon.attr('class', 'glyphicon glyphicon-refresh glyphicon-spin');
        } else {
            progressInfoIcon.attr('class', '');
        }
    }
}

MyVars.getAllProps = async function () {
    var propTree = {};
    var handled = [];
    var getProps = async function (id, propNode) {
        return new Promise(resolve => {
            NOP_VIEWER.getProperties(id, props => {
                resolve(props);
            });
        });
    };
    
    var getPropsRec = async function (id, propNode) {
        var props = await getProps(id, propNode);
        handled.push(props.dbId);
        propNode['child_' + props.dbId] = props.properties;

        for (var key in props.properties) {
            var prop = props.properties[key];
            // Avoid circular reference by checking if it's been
            // handled already
            if (prop.type === 11 && ! handled.includes(prop.displayValue)) {
                await getPropsRec(prop.displayValue, propNode['child_' + props.dbId]);
            }
        };
    }
    
    await getPropsRec(NOP_VIEWER.model.getRootId(), propTree);
    console.log(propTree);
}

function getActiveConfigurationProperties (viewer) {
    var dbIds = viewer.getSelection();

    if (dbIds.length !== 1) {
        alert("Select a single type first!");
        return;
    }

    viewer.getProperties(dbIds[0], (props) => {
        props.properties.forEach(prop => {
            if (prop.displayName === "Active Configuration") {
                viewer.getProperties(prop.displayValue, confProps => {
                    console.log(confProps);        
                });  

                return;
            }
        })
    })
}




// *******************************************
// Property Inspector Extension
// *******************************************
function PropertyInspectorExtension(viewer, options) {
    Autodesk.Viewing.Extension.call(this, viewer, options);
    this.panel = null;
}

PropertyInspectorExtension.prototype = Object.create(Autodesk.Viewing.Extension.prototype);
PropertyInspectorExtension.prototype.constructor = PropertyInspectorExtension;

PropertyInspectorExtension.prototype.load = function () {
    if (this.viewer.toolbar) {
        // Toolbar is already available, create the UI
        this.createUI();
    } else {
        // Toolbar hasn't been created yet, wait until we get notification of its creation
        this.onToolbarCreatedBinded = this.onToolbarCreated.bind(this);
        this.viewer.addEventListener(av.TOOLBAR_CREATED_EVENT, this.onToolbarCreatedBinded);
    }
    return true;
};

PropertyInspectorExtension.prototype.onToolbarCreated = function () {
    this.viewer.removeEventListener(av.TOOLBAR_CREATED_EVENT, this.onToolbarCreatedBinded);
    this.onToolbarCreatedBinded = null;
    this.createUI();
};

PropertyInspectorExtension.prototype.createUI = function () {
    var viewer = this.viewer;
    var panel = this.panel;

    // button to show the docking panel
    var toolbarButtonShowDockingPanel = new Autodesk.Viewing.UI.Button('showPropertyInspectorPanel');
    toolbarButtonShowDockingPanel.icon.classList.add("adsk-icon-properties");
    toolbarButtonShowDockingPanel.container.style.color = "orange";
    toolbarButtonShowDockingPanel.onClick = function (e) {
        // if null, create it
        if (panel == null) {
            panel = new PropertyInspectorPanel(viewer, viewer.container, 'AllPropertiesPanel', 'All Properties');
            panel.showProperties(viewer.model.getRootId());
        }
        // show/hide docking panel
        panel.setVisible(!panel.isVisible());
    };
    
    toolbarButtonShowDockingPanel.addClass('propertyInspectorToolbarButton');
    toolbarButtonShowDockingPanel.setToolTip('Property Inspector Panel');

    // SubToolbar
    this.subToolbar = new Autodesk.Viewing.UI.ControlGroup('PropertyInspectorToolbar');
    this.subToolbar.addControl(toolbarButtonShowDockingPanel);

    viewer.toolbar.addControl(this.subToolbar);
};

PropertyInspectorExtension.prototype.unload = function () {
    this.viewer.toolbar.removeControl(this.subToolbar);
    return true;
};

Autodesk.Viewing.theExtensionManager.registerExtension('PropertyInspectorExtension', PropertyInspectorExtension);

// *******************************************
// Property Inspector Extension
// *******************************************

function PropertyInspectorPanel (viewer, container, id, title, options) {
    this.viewer = viewer;
    this.breadcrumbsItems = [];
    Autodesk.Viewing.UI.PropertyPanel.call(this, container, id, title, options);

    this.showBreadcrumbs = function () {
        // Create it if not there yet
        if (!this.breadcrumbs) {
            this.breadcrumbs = document.createElement('span');   
            this.title.appendChild(this.breadcrumbs);
        } else {
            while (this.breadcrumbs.firstChild) {
                this.breadcrumbs.removeChild(this.breadcrumbs.firstChild);
            }
        }

        // Fill it with items
        this.breadcrumbs.appendChild(document.createTextNode(' ['));
        this.breadcrumbsItems.forEach(dbId => {
            if (this.breadcrumbs.children.length > 0) {
                var text = document.createTextNode(' > ');
                this.breadcrumbs.appendChild(text);
            }
            
            var type = document.createElement('a');
            type.innerText = dbId;
            type.style.cursor = "pointer";
            type.onclick = this.onBreadcrumbClick.bind(this);
            this.breadcrumbs.appendChild(type);
        });
        this.breadcrumbs.appendChild(document.createTextNode(']'));
    }; // showBreadcrumbs

    this.showProperties = function (dbId) {
        this.removeAllProperties();

        var that = this;
        this.viewer.getProperties(dbId, props => {
            props.properties.forEach(prop => {
                that.addProperty(
                    prop.displayName + ((prop.type === 11) ? "[dbId]" : ""),
                    prop.displayValue,
                    prop.displayCategory
                );
            });
        });

        this.breadcrumbsItems.push(dbId);
        this.showBreadcrumbs();
    }; // showProperties

    this.onBreadcrumbClick = function (event) {
        var dbId = parseInt(event.currentTarget.text);
        var index = this.breadcrumbsItems.indexOf(dbId)
        this.breadcrumbsItems = this.breadcrumbsItems.splice(0, index);

        this.showProperties(dbId);
    }; // onBreadcrumbClicked

    // This is overriding the default property click handler
    // of Autodesk.Viewing.UI.PropertyPanel
    this.onPropertyClick = function (property) {
        if (!property.name.includes("[dbId]")) {
            return;
        }

        var dbId = property.value;
        this.showProperties(dbId);
    }; // onPropertyClick

    this.onSelectionChanged = function (event) {
        var dbId = event.dbIdArray[0];

        if (!dbId) {
            dbId = this.viewer.model.getRootId();
        }

        this.breadcrumbsItems = [];   
        this.showProperties(dbId);
    } // onSelectionChanged

    viewer.addEventListener(
        Autodesk.Viewing.SELECTION_CHANGED_EVENT, 
        this.onSelectionChanged.bind(this)
    );
}; // PropertyInspectorPanel
PropertyInspectorPanel.prototype = Object.create(Autodesk.Viewing.UI.PropertyPanel.prototype);
PropertyInspectorPanel.prototype.constructor = PropertyInspectorPanel;

