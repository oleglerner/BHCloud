import {insertNew} from './newingestion';

export const cloudFuncMap = {
    CloudSubscriptions: buildCloudSubscriptions,
    CloudRGs: buildCloudRGs,
    CloudNICs: buildCloudNICJson,
    CloudNSGs: buildCloudNSGJson,
    CloudVMs: buildCloudVMJson,
    CloudHDs: buildCloudHDJson,
    CloudKeyVaults: buildCloudKeyVaultJson,
    CloudMIs: buildCloudManagedIdentityJson,
    CloudRBACs: buildCloudRBACJson,
    CloudRoles: buildCloudRoleJson,
    CloudRAs: buildCloudRoleAssignmentsJson,
    CloudAADRAs: buildAADRoleAssignmentJson,
    CloudApps: buildCloudAppsJson,
}
export const acceptableType = [
    'CloudNICs',
    'CloudVMs',
    'CloudHDs',
    'CloudKeyVaults',
    'CloudMIs',
    'CloudRBACs',
    'CloudNSGs',
    'CloudRoles',
    'CloudRAs',
    'CloudAADRAs',
    'CloudRGs',
    'CloudSubscriptions',
    'CloudApps',
]

export function buildCloudSubscriptions(chunk) {
    let queries = {};
    queries.properties = {
        statement:
            'UNWIND $props AS prop MERGE (n:CloudSubscription {objectid: prop.source}) SET n += prop.map',
        props: [],
    };

    // Insert each subscription to statement 
    for (let subscription of chunk) {
        // Create properties for Subscription
        let properties = { name: subscription.name, tenant: subscription.tenantId };
        let source = subscription.id;
        queries.properties.props.push({ source: source, map: properties });

        for (let group of subscription.ResourceGroups.value) {
            // TODO: lowercase just a fix
            let target = group.id.split('/')[4].toLowerCase().trim();
            // Create link between subscription and Resource Group
            let props = { source: source, target: target };
            let format = ['CloudSubscription', 'CloudRG', 'Hosts', '{isacl: false}'];
            insertNew(queries, format, props);
        }
    }
    return queries;
}

export function buildCloudAppsJson(chunk) {
    let queries = {};
    queries.properties = {
        statement:
            'UNWIND $props AS prop MERGE (n:CloudApp {objectid: prop.source}) SET n += prop.map',
        props: [],
    };

    // Insert each application to statement
    for (let app of chunk) {
        // Application properties set
        let identifier = app.appId;
        let properties = { name: app.displayName, homepage: app.homepage };

        queries.properties.props.push({ source: identifier, map: properties });

        // Create link between owner to application
        for (let owner of app.Owners) {
            // Set owner id to AD SID or AzureAD GUID
            let source = owner.ObjectId;
            if (owner.OnPremisesSecurityIdentifier !== null) {
                source = owner.OnPremisesSecurityIdentifier
            }
            let props = { source: source, target: identifier };
            let format = [owner.ObjectType, 'CloudApp', 'Owner', '{isacl: false}'];
            insertNew(queries, format, props);
        }
        // Create link between application to resource by access
        for (let ra of app.requiredResourceAccess) {
            for (let ra1 of ra.resourceAccess) {
                // TODO: Handle all types (e.g scope)
                if (ra1.type !== 'Role') { continue; }
                let props = { source: identifier, target: ra1.id };
                let format = ['CloudApp', 'CloudRole', 'HasRole', '{isacl: false}'];
                insertNew(queries, format, props);
            }
        }
    }
    return queries;
}

// TODO: Remove comments
export function buildAADRoleAssignmentJson(chunk) {
    let queries = {};
    queries.properties = {
        statement:
            'UNWIND $props AS prop MERGE (n:CloudRole {objectid: prop.source}) SET n += prop.map',
        props: [],
    };

    // TODO: Add tenantID

    // Create AzureAD roles
    for (let role of chunk) {
        let properties = { name: role.DisplayName, description: role.Description, highvalue: false };
        if (role.DisplayName.includes("Admin")) {
            properties.highvalue = true;
        }
        queries.properties.props.push({ source: role.ObjectId, map: properties });

        // Link members to role
        for (let member of role.Members) {
            let type = member.ObjectType;
            // Set user id to AD SID if exists, otherwise to AzureAD GUID
            let source = member.OnPremisesSecurityIdentifier;
            if (source === null || source === undefined) { source = member.ObjectId }
            let props = { source: source, target: role.ObjectId };
            let format = [type, 'CloudRole', 'HasRole', '{isacl: false}'];
            insertNew(queries, format, props);
        }
    }
    return queries;
}

// TODO: Remove comments
export function buildCloudRoleAssignmentsJson(chunk) {
    let queries = {};
    // queries.properties = {};
    // queries.properties.statement = 
    //     'UNWIND $props AS prop MERGE (n:CloudRole {objectid: prop.source}) SET n += prop.map';
    // queries.properties.props = [];

    for (let ra of chunk) {
        let source = ra.PrincipalId;
        let type = ra.PrincipalType;
        switch (type) {
            case "ServicePrincipal":
                type = "CloudSP";
                break;
        }
        if (ra.PrincipalSID !== null && ra.PrincipalSID !== undefined) { source = ra.PrincipalSID }
        let props = { source: source, target: ra.Id };
        let format = [type, 'CloudRole', 'HasRole', '{isacl: false}'];
        insertNew(queries, format, props);
    }
    return queries;
}

export function buildCloudRoleJson(chunk) {
    let queries = {};
    queries.properties = {
        statement:
            'UNWIND $props AS prop MERGE (n:CloudRole {objectid: prop.source}) SET n += prop.map',
        props: [],
    };

    queries.sp = {
        statement:
            'UNWIND $props AS prop MERGE (n:CloudSP {objectid: prop.source}) SET n += prop.map',
        props: [],
    };

    queries.app = {
        statement:
            'UNWIND $props AS prop MERGE (n:CloudApp {objectid: prop.source}) SET n += prop.map',
        props: [],
    };

    for (let sp of chunk) {
        // Cloud Service Principal 
        queries.sp.props.push({ source: sp.objectId, map: { name: sp.displayName, type: sp.objectType } });
        // Cloud Applications
        queries.app.props.push({ source: sp.appId, map: { name: sp.appDisplayName } });
        // Link Service Primcipal to Application
        let format = ['CloudSP', 'CloudApp', 'ServicePrincipal', '{isacl: false}'];
        let props = { source: sp.objectId, target: sp.appId };
        insertNew(queries, format, props);

        // Service Principals roles
        for (let role of sp.appRoles) {
            let identifier = role.id;
            let properties = {
                name: role.displayName, description: role.description, highvalue: false,
                isEnabled: role.isEnabled, value: role.value, allowedMemberType: role.allowedMemberType
            };
            // Mark high value target
            if (role.value !== null && role.value.includes("Directory.ReadWrite.All")) {
                properties.highvalue = true;
            } else if (role.value !== null && role.value.includes("RoleManagement.ReadWrite.Directory")) {
                properties.highvalue = true;
            }
            // Create Role
            queries.properties.props.push({ source: identifier, map: properties });
            // Link role to Service Principal
            let format = ['CloudRole', 'CloudSP', 'RoleOf', '{isacl: false}'];
            let props = { source: identifier, target: sp.objectId };
            insertNew(queries, format, props);
        }

    }
    return queries;
}

export function buildCloudRBACJson(chunk) {
    let queries = {};
    queries.properties = {
        statement:
            'UNWIND $props AS prop MERGE (n:CloudRole {objectid: prop.source}) SET n += prop.map',
        props: [],
    };

    for (let rbac of chunk) {
        // Principal that has rbac
        let roleId = rbac.roleDefinitionId;
        let roleName = rbac.roleDefinitionName;
        // Resource to which the rbac is relevant
        let resourceId = rbac.scope;

        // Map resource to type
        let resourceType = null;
        if (rbac.scope.includes("vaults")) {
            resourceType = "CloudKeyVault";
        } else if (rbac.scope.includes("virtualMachines")) {
            resourceType = "CloudVM";
        } else if (rbac.scope.includes("storageAccounts")) {
            resourceType = "CloudStorage";
        } else if (rbac.scope.includes("managedClusters")) {
            resourceType = "CloudCluster";
        } else if (rbac.scope.toLowerCase().includes("resourcegroups")) {
            // TODO: lowercase just a fix
            resourceId = rbac.scope.split('/')[4].toLowerCase().trim();
            resourceType = "CloudRG";
        } else if (rbac.scope.includes("subscriptions")) {
            resourceId = rbac.scope.split('/')[2]
            resourceType = "CloudSubscription";
        }

        // Service principal Type
        let principalType = rbac.principalType;
        switch (principalType) {
            case "User":
                break;
            case "Group":
                break;
            case "ServicePrincipal":
                principalType = "CloudSP";
                break;
            case "ForeignGroup":
                break;
            default:
                break;
        }
        let format = [principalType, resourceType, roleName.split(" ").join(""), '{isacl: false, isrbac: true}'];
        let props = { source: rbac.principalId, target: resourceId };
        insertNew(queries, format, props);

    }
    return queries;
}

export function buildCloudManagedIdentityJson(chunk) {
    let queries = {};
    queries.properties = {
        statement:
            'UNWIND $props AS prop MERGE (n:CloudSP {objectid: prop.source}) SET n += prop.map',
        props: [],
    };

    for (let mi of chunk) {
        let properties = {
            name: mi.name, principalId: mi.principalId,
            clientSecret: mi.clientSecretUrl, type: "Managed Identity"
        };
        let identifier = mi.principalId;
        queries.properties.props.push({ source: identifier, map: properties });
    }
    return queries;
}

export function buildCloudKeyVaultJson(chunk) {
    let queries = {};
    queries.properties = {
        statement:
            'UNWIND $props AS prop MERGE (n:CloudKeyVault {objectid: prop.source}) SET n += prop.map',
        props: [],
    };

    for (let kv of chunk) {
        let properties = { name: kv.name, location: kv.location };
        let identifier = kv.id;
        queries.properties.props.push({ source: identifier, map: properties });

        // Attach to resource group
        let format = ['CloudRG', 'CloudKeyVault', 'Hosts', '{isacl:false}'];
        // TODO: lowercase is just a fix
        let props = { source: kv.resourceGroup.toLowerCase().trim(), target: identifier };
        insertNewRG(queries, format, props);
    }

    return queries;
}

export function buildCloudHDJson(chunk) {
    let queries = {};
    queries.properties = {
        statement:
            'UNWIND $props AS prop MERGE (n:CloudHD {objectid: prop.source}) SET n += prop.map',
        props: [],
    };

    for (let hd of chunk) {
        let properties = { name: hd.name, profile: hd.creationData.imageReference };
        let identifier = hd.id;
        queries.properties.props.push({ source: identifier, map: properties });

        if (hd.managedBy === null) { continue; }
        let props = { source: identifier, target: hd.managedBy };
        let format = ['CloudHD', 'CloudVM', 'AttachedTo', '{isacl:false}'];
        insertNew(queries, format, props);
    }

    return queries;
}

export function buildCloudVMJson(chunk) {
    let queries = {};
    queries.properties = {
        statement:
            'UNWIND $props AS prop MERGE (n:CloudVM {objectid: prop.source}) SET n += prop.map',
        props: [],
    };

    for (let vm of chunk) {
        // TODO: fix
        let properties = {};
        try {
            properties = { name: vm.name, computerName: vm.storageProfile.imageReference.exactVersion, admin_user: vm.osProfile.adminUsername };
        } catch {
            properties = { name: vm.name };
        }
        let identifier = vm.id;
        // TODO: FIX
        if (identifier === "/subscriptions/433898dc-6b7d-44a3-a9da-8563111e4dee/resourceGroups/T8DEVNEW/providers/Microsoft.Compute/virtualMachines/OPSWAT") { debugger; }
        
        let identities = vm.identity;
        queries.properties.props.push({ source: identifier, map: properties });

        // Attach to resource group
        let format = ['CloudRG', 'CloudVM', 'Hosts', '{isacl:false}'];
        // TODO: lowercase is just a fix
        let props = { source: vm.resourceGroup.toLowerCase().trim(), target: identifier };
        insertNewRG(queries, format, props);


        // find all Managed Identities attached per VM
        format = ['CloudVM', 'CloudSP', 'HasPermissionsOf', '{isacl:false}'];
        // MATCH (n:CloudVM) with n MATCH (m:CloudKeyVault) with n,m match p=(n)-[*]-(m) return p
        if (identities !== null && identities.userAssignedIdentities !== null) {
            $.each(identities.userAssignedIdentities, function (_, identity) {
                let props = { source: identifier, target: identity.principalId }
                insertNew(queries, format, props);
            });
        }

        // Attach each NIC to VM
        for (let nic of vm.networkProfile.networkInterfaces) {
            let props = { source: nic.id, target: identifier }
            let format = ['CloudNIC', 'CloudVM', 'AttachedTo', '{isacl:false}'];
            insertNew(queries, format, props);
        }
    }

    return queries;
}

// Build cloud resource groups
export function buildCloudRGs(chunk) {
    let queries = {};
    queries.properties = {
        statement:
            'UNWIND $props AS prop MERGE (n:CloudRG {objectid: prop.source}) SET n += prop.map',
        props: [],
    };

    // add each resource group, resource group needed for premissions inheritence
    for (let rg of chunk) {
        // TODO: lowercase is just a fix
        let properties = { name: rg.name.toLowerCase().trim(), location: rg.location };
        let identifier = rg.id.split('/')[4].toLowerCase().trim();

        queries.properties.props.push({ source: identifier, map: properties });
    }

    return queries;
}

export function buildCloudNSGJson(chunk) {
    let queries = {};
    queries.properties = {
        statement:
            'UNWIND $props AS prop MERGE (n:CloudNSG {objectid: prop.source}) SET n += prop.map',
        props: [],
    };

    for (let nsg of chunk) {
        let properties = { name: nsg.name, location: nsg.location };
        let identifier = nsg.id;
        queries.properties.props.push({ source: identifier, map: properties });

        // Iterate Security rules
        for (let secRules of nsg.securityRules) {
            // Inbound rules
            if (secRules.direction === "Inbound" && secRules.access === "Allow") {
                let props = secRules.sourceAddressPrefixes.map(ip => {
                    return { source: ip, target: identifier };
                })
                if (secRules.sourceAddressPrefix !== null) {
                    props = props.concat({ source: secRules.sourceAddressPrefix, target: identifier });
                }
                let info = "{protocol: '{0}'}".formatn(secRules.protocol);
                let format = ['IP', 'CloudNSG', 'Inbound', '{isacl:false}'];
                insertNew(queries, format, props);
            }
        }
        // Iterate connected NICs
        if (nsg.networkInterfaces === null) { continue; }
        for (let nic of nsg.networkInterfaces) {
            let props = { source: identifier, target: nic.id };
            let format = ['CloudNSG', 'CloudNIC', 'AttachedTo', '{isacl:false}'];
            insertNew(queries, format, props);
        }
    }
    return queries;
}

export function buildCloudNICJson(chunk) {
    let queries = {};
    queries.properties = {
        statement:
            'UNWIND $props AS prop MERGE (n:CloudNIC {objectid: prop.source}) SET n += prop.map',
        props: [],
    };

    for (let nic of chunk) {
        // Insert each NIC
        let properties = { name: nic.name, macAddress: nic.macAddress };
        let identifier = nic.id;
        queries.properties.props.push({ source: identifier, map: properties });

        // Attach each NIC to Resource Group
        let format = ['CloudRG', 'CloudNIC', 'Hosts', '{isacl:false}'];
        // TODO: Lowercase is just a fix
        let props = { source: nic.resourceGroup.toLowerCase().trim(), target: identifier };
        insertNewRG(queries, format, props);

        // TODO: Check if possible to create relation to NSG
        // if (nic.networkSecurityGroup === null) { continue; }
        // for(let nsg of nic.networkSecurityGroup){
        //     let props = {source: identifier, target: nsg.id}
        //     let format = ['CloudNIC', 'CloudNSG', 'AttachedTo', '{isacl:false}'];
        //     insertNew(queries, format, props);
        // }
    }

    return queries;
}

const baseInsertStatementByName =
    'UNWIND $props AS prop MERGE (n:{0} {objectid: prop.source}) MERGE (m:{1} {objectid: prop.target}) MERGE (n)-[r:{2} {3}]->(m)';

function insertNewRG(queries, formatProps, queryProps) {
    if (formatProps.length < 4) {
        throw new NotEnoughArgumentsException();
    }
    if (queryProps.length == 0) {
        return;
    }
    let hash = `${formatProps[0]}-${formatProps[1]}-${formatProps[2]}`;
    if (queries[hash]) {
        queries[hash].props = queries[hash].props.concat(queryProps);
    } else {
        queries[hash] = {};
        if (formatProps.length < 4) {
            throw new NotEnoughArgumentsException();
        }
        queries[hash].statement = baseInsertStatementByName.formatn(...formatProps);
        queries[hash].props = [].concat(queryProps);
    }
}