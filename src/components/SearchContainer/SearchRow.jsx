import React from 'react';
import {Highlighter} from 'react-bootstrap-typeahead';

const SearchRow = (item, props) => {
    let searched;
    let search = props.text;
    if (search.includes(':')) {
        searched = search.split(':')[1];
    } else {
        searched = search;
    }
    let type = item.type;
    let icon = {};
    icon.style = { marginLeft: '10px' };

    switch (type) {
        case 'Group':
            icon.className = 'fa fa-users';
            break;
        case 'User':
            icon.className = 'fa fa-user';
            break;
        case 'Computer':
            icon.className = 'fa fa-desktop';
            break;
        case 'Domain':
            icon.className = 'fa fa-globe';
            break;
        case 'GPO':
            icon.className = 'fa fa-list';
            break;
        case 'OU':
            icon.className = 'fa fa-sitemap';
            break;
        case 'CloudNIC':
            icon.className = 'fa fa-wifi';
            break;
        case 'CloudNSG':
            icon.className = 'fa fa-arrows-alt';
            break;
        case 'IP':
            icon.className = 'fa fa-cloud';
            break;
        case 'CloudVM':
            icon.className = 'fa fa-cube';
            break;
        case 'CloudHD':
            icon.className = 'fa fa-hdd';
            break;
        case 'CloudKeyVault':
            icon.className = 'fa fa-key';
            break;
        case 'CloudMI':
            icon.className = 'fa fa-male';
            break;
        case 'CloudSubscription':
            icon.className = 'fa fa-certificate';
            break;
        case 'CloudRG':
            icon.className = 'fa fa-database';
            break;
        case 'CloudRole':
            icon.className = 'fa fa-user-secret';
            break;
        case 'CloudApp':
            icon.className = 'fa fa-cog';
            break;
        case 'CloudSP':
            icon.className = 'fa fa-smile-o';
            break;
    }

    let name = item.name || item.objectid;

    return (
        <>
            <span>
                <i {...icon} />
            </span>
            <Highlighter matchElement='strong' search={searched}>
                {name}
            </Highlighter>
        </>
    );
};

SearchRow.propTypes = {};
export default SearchRow;
