import React, { Component } from 'react';

const dataDisplay = [
    {session: null, query: 'MATCH (n:CloudNIC) RETURN count(n)', state: {num_cloudnics: 0}},
    {session: null, query: 'MATCH (n:CloudVM) RETURN count(n)', state: {num_cloudvms: 0}},
    {session: null, query: 'MATCH (n:CloudHD) RETURN count(n)', state: {num_cloudhds: 0}},
    {session: null, query: 'MATCH (n:CloudKeyVault) RETURN count(n)', state: {num_keyvaults: 0}},
    {session: null, query: 'MATCH (n:CloudMI) RETURN count(n)', state: {num_mis: 0}},
    {session: null, query: 'MATCH (n:CloudNSG) RETURN count(n)', state: {num_nsgs: 0}},
    {session: null, query: 'MATCH (n:CloudRole) RETURN count(n)', state: {num_roles: 0}},
    {session: null, query: 'MATCH (n:CloudRG) RETURN count(n)', state: {num_rgs: 0}},
    {session: null, query: 'MATCH (n:CloudSubscription) RETURN count(n)', state: {num_subscriptions: 0}},
    {session: null, query: 'MATCH ()-[r {isrbac: true}]->() RETURN count(r)', state: {num_rbacs: 0}}
]

export default class DatabaseDataDisplay extends Component {
    constructor() {
        super();
        this.state = {
            url: appStore.databaseInfo.url,
            user: appStore.databaseInfo.user,
            num_users: 'Refreshing',
            num_computers: 'Refreshing',
            num_groups: 'Refreshing',
            num_relationships: 'Refreshing',
            num_sessions: 'Refreshing',
            num_acls: 'Refreshing',
            num_cloudnics: 'Refreshing',
            num_cloudvms: 'Refreshing',
            num_cloudhds: 'Refreshing',
            num_keyvaults: 'Refreshing',
            num_mis: 'Refreshing',
            num_nsgs: 'Refreshing',
            num_roles: 'Refreshing',
            num_subscriptions: 'Refreshing',
            num_rgs: 'Refreshing',
            num_rbacs: 'Refreshing',
            interval: null,
        };
    }

    componentDidMount() {
        this.refreshDBData();
        emitter.on('hideDBClearModal', this.refreshDBData.bind(this));
        emitter.on('refreshDBData', this.refreshDBData.bind(this));
        this.createInterval();
    }

    componentWillUnmount() {
        clearInterval(this.state.interval);
        this.setState({
            interval: null,
            session: null,
        });
    }

    createInterval() {
        var x = setInterval(() => {
            this.refreshDBData();
        }, 60000);
        this.setState({
            interval: x,
        });
    }

    toggleLogoutModal() {
        emitter.emit('showLogout');
    }

    toggleDBWarnModal() {
        emitter.emit('openDBWarnModal');
    }

    toggleSessionClearModal() {
        emitter.emit('openSessionClearModal');
    }

    toggleWarmupModal() {
        emitter.emit('openWarmupModal');
    }

    refreshDBData() {
        var s1 = driver.session();
        var s2 = driver.session();
        var s3 = driver.session();
        var s4 = driver.session();
        var s5 = driver.session();
        var s6 = driver.session();

        dataDisplay.forEach(element => {
            element.session = driver.session();
            element.session.run(element.query).then(result => {
                element.state[Object.keys(element.state)[0]] = result.records[0]._fields[0].toLocaleString();
                this.setState(element.state);
                element.session.close();
            })
        });

        s1.run(
            "MATCH (n:User) WHERE NOT n.name ENDS WITH '$' RETURN count(n)"
        ).then(result => {
            this.setState({
                num_users: result.records[0]._fields[0].toLocaleString(),
            });
            s1.close();
        });

        s2.run('MATCH (n:Group) RETURN count(n)').then(result => {
            this.setState({
                num_groups: result.records[0]._fields[0].toLocaleString(),
            });
            s2.close();
        });

        s3.run('MATCH (n:Computer) RETURN count(n)').then(result => {
            this.setState({
                num_computers: result.records[0]._fields[0].toLocaleString(),
            });
            s3.close();
        });

        s4.run('MATCH ()-[r:HasSession]->() RETURN count(r)').then(result => {
            this.setState({
                num_sessions: result.records[0]._fields[0].toLocaleString(),
            });
            s4.close();
        });

        s6.run('MATCH ()-[r {isacl: true}]->() RETURN count(r)').then(
            result => {
                this.setState({
                    num_acls: result.records[0]._fields[0].toLocaleString(),
                });
                s6.close();
            }
        );

        s5.run('MATCH ()-[r]->() RETURN count(r)').then(result => {
            this.setState({
                num_relationships: result.records[0]._fields[0].toLocaleString(),
            });
            s5.close();
        });
    }

    render() {
        return (
            <div>
                <h3>Database Info</h3>
                <dl className='dl-horizontal dl-horizontal-fix'>
                    <dt>DB Address</dt>
                    <dd>{this.state.url}</dd>
                    <dt>DB User</dt>
                    <dd>{this.state.user}</dd>
                    <dt>Users</dt>
                    <dd>{this.state.num_users}</dd>
                    <dt>Computers</dt>
                    <dd>{this.state.num_computers}</dd>
                    <dt>Groups</dt>
                    <dd>{this.state.num_groups}</dd>
                    <dt>Sessions</dt>
                    <dd>{this.state.num_sessions}</dd>
                    <dt>ACLs</dt>
                    <dd>{this.state.num_acls}</dd>
                    <dt>Relationships</dt>
                    <dd>{this.state.num_relationships}</dd>
                    <dt>Cloud NICs</dt>
                    <dd>{this.state.num_cloudnics}</dd>
                    <dt>Cloud VMs</dt>
                    <dd>{this.state.num_cloudvms}</dd>
                    <dt>Cloud HDs</dt>
                    <dd>{this.state.num_cloudhds}</dd>
                    <dt>Cloud KeyVault</dt>
                    <dd>{this.state.num_keyvaults}</dd>
                    <dt>Cloud Managed Identities</dt>
                    <dd>{this.state.num_mis}</dd>
                    <dt>Cloud NSGs</dt>
                    <dd>{this.state.num_nsgs}</dd>
                    <dt>Cloud Roles</dt>
                    <dd>{this.state.num_roles}</dd>
                    <dt>Cloud Resource Groups</dt>
                    <dd>{this.state.num_rgs}</dd>
                    <dt>Cloud Subscriptions</dt>
                    <dd>{this.state.num_subscriptions}</dd>
                    <dt>Cloud RBACs</dt>
                    <dd>{this.state.num_rbacs}</dd>
                </dl>

                <div className='text-center'>
                    <div className='btn-group-vertical btn-group-sm dbbuttons'>
                        <button
                            type='button'
                            className='btn btn-success'
                            onClick={function() {
                                this.refreshDBData();
                            }.bind(this)}
                        >
                            Refresh DB Stats
                        </button>
                        <button
                            type='button'
                            className='btn btn-success'
                            onClick={this.toggleWarmupModal}
                        >
                            Warm Up Database
                        </button>
                    </div>
                    <div className='btn-group-vertical btn-group-sm dbbuttons'>
                        <button
                            type='button'
                            className='btn btn-info'
                            onClick={this.toggleSessionClearModal}
                        >
                            Clear Sessions
                        </button>
                        <button
                            type='button'
                            className='btn btn-danger'
                            onClick={this.toggleDBWarnModal}
                        >
                            Clear Database
                        </button>
                    </div>
                    <div className='btn-group-vertical btn-group-sm dbbuttonslast'>
                        <button
                            type='button'
                            className='btn btn-warning'
                            onClick={this.toggleLogoutModal}
                        >
                            Log Out/Switch DB
                        </button>
                    </div>
                </div>
            </div>
        );
    }
}
