# TODO: List tenants ids

function TenantLogin {
    param(
        [Parameter(Position = 0)]
        [ValidateNotNullOrEmpty()]
        [String]
        $tenantId = $null 
    )
    
    Write-Host "Teanat Login: $tenantId"
    az login -t $tenantId --allow-no-subscriptions
    Connect-AzureAD -TenantId $tenantId
    Write-Host "Conected successfully"
}

function WriteContent {
    param(
        [Parameter(Position = 0)]
        [String]
        $type,

        [Parameter(Position = 1)]
        $data,

        [Parameter(Position = 2)]
        [Int]
        $count,

        [Parameter(Position = 3)]
        [String]
        $outPath = $null
    )
    $content = "{`"$type`": $data, `"meta`":{`"type`": `"$type`", `"count`": $count, `"version`": `"3`"}}"
    if($outPath -eq ""){
        $path = (Get-Location).Path + "\$type.json"
    } else {
        $path = "$outPath\$type.json"
    }
    Set-Content -Path $path $content
}

function GetSubscriptionResourceGroups {
    <#
    .SYNOPSIS

        List all available resource groups in subscriptions

        Author: Oleg Lerner (@mattifestation)
        License: BSD 3-Clause
        Required Dependencies: None
        Optional Dependencies: None

    .DESCRIPTION

        Some description

    .PARAMETER ModuleName

        

    .EXAMPLE

        
#>
    param(
        [Parameter(Position = 0)]
        [String]
        $outPath = $null
    )
    
    Write-Host "List resource groups in subscription"

    $resourceGroups = az group list
    $rgsCount = ($resourceGroups | ConvertFrom-Json).Count
    $type = "CloudRGs"

    WriteContent -type $type -data $resourceGroups -count $rgsCount -outPath $outPath
}

function GetSubscriptions {
    param(
        [Parameter(Position = 0)]
        [String]
        $outPath = $null
    )

    Write-Host "List subscriptions in tenant"
    $subscriptions = az account list | ConvertFrom-Json
    $subscriptionsCount = $subscriptions.Count
    # List all resource groups per subscription
    foreach($subscription in $subscriptions) {
        $rgs = (az group list --subscription $subscription.id | ConvertFrom-Json)
        $subscription | Add-Member -MemberType NoteProperty -Name ResourceGroups -Value $rgs
    }
    $type = "CloudSubscriptions"
    # TODO: Test on multiple subscritpions
    $subscriptionsJson = ConvertTo-Json -InputObject @($subscriptions) -Depth 4

    WriteContent -type $type -data $subscriptionsJson -count $subscriptionsCount -outPath $outPath
}

function GetVMsInSubscription {
    param(
        [Parameter(Position = 0)]
        [String]
        $outPath = $null
    )
    
    Write-Host "List VMs in subscription"

    $vms = az vm list
    $vmsCount = ($vms | ConvertFrom-Json).length
    $type = "CloudVMs"
    $vms = $vms

    WriteContent -type $type -data $vms -count $vmsCount -outPath $outPath
}

function GetNICsInSubscription {
    param(
        [Parameter(Position = 0)]
        [String]
        $outPath = $null
    )
    
    Write-Host "Get Network cards in subscription"

    $nics = az network nic list
    $nicsCount = ($nics | ConvertFrom-Json).length
    $type = "CloudNICs"
    $nics = "$nics"

    WriteContent -type $type -data $nics -count $nicsCount -outPath $outPath
}

function GetNSGsInSubscription {
    param(
        [Parameter(Position = 0)]
        [String]
        $outPath = $null
    )
    
    Write-Host "List Network Security Groups in subscription"

    $nsgs = az network nsg list
    $nsgsCount = ($nsgs | ConvertFrom-Json).length
    $type = "CloudNSGs"
    WriteContent -type $type -data $nsgs -count $nsgsCount -outPath $outPath
}

function GetKeyVaultsInSubscription {
    param(
        [Parameter(Position = 0)]
        [String]
        $outPath = $null
    )
    
    Write-Host "List Key Vaults in subscription"

    $kvs = az keyvault list
    $kvsCount = ($kvs | ConvertFrom-Json).length
    $type = "CloudKeyVaults"
    WriteContent -type $type -data $kvs -count $kvsCount -outPath $outPath
}

function GetManagedIdentitiesInSubscription {
    param(
        [Parameter(Position = 0)]
        [String]
        $outPath = $null
    )  
    
    Write-Host "List Managed Identities in subscription"
    # Managed Identities
    $mis = az identity list
    $misCount = ($mis | ConvertFrom-Json).length
    $type = "CloudMIs"
    WriteContent -type $type -data $mis -count $misCount -outPath $outPath
}

function QueryResouceRBAC {
    param(
        $resources
    )

    Set-Variable maxJobs -Option Constant -Value 50

    $i = 0
    foreach ($resource in $resources){
        $perc = ($i / $resources.length) * 100
        Write-Progress -Activity "RBAC for resource" -Status "Resource: $resource" -PercentComplete $perc
        if($resource.type -eq "Microsoft.OperationsManagement/solutions") { continue }
        $scriptblock = {az role assignment list --scope $using:resource.id | ConvertFrom-Json}
        
        while ( (Get-Job -state "Running").Count -ge $maxJobs ){
            Start-Sleep 30
        }
        Start-Job $scriptblock
        $i++
    }
}

function GetRBACsInSubscription {
    param(
        [Parameter(Position = 0)]
        [String]
        $outPath = $null
    )
    
    Write-Host "List RBACs in subscription"

    # list RBAC (per resource, per subscription, per resource group)
    # Resource level RBACs
    $resources = az resource list | ConvertFrom-Json
    # Resource group level RBACs
    $rgs = az group list | ConvertFrom-Json
    # Subscription level RBACs
    $rbacs += az role assignment list | ConvertFrom-Json

    [System.Collections.ArrayList]$rbacs = New-Object System.Collections.ArrayList 
    # Resource level RBACS
    QueryResouceRBAC -resources $resources
    
    # Resource Group level RBACS
    QueryResouceRBAC -resources $rgs

    while ((Get-Job).Count -ne 0) {
        $rbacs += (Get-Job -state "Completed" | Receive-Job -Wait -AutoRemoveJob).ToArray()
        Start-Sleep 20
    }
   
    $rbacsCount = $rbacs.Count
    $type = "CloudRBACs"
    $rbacsJson = $rbacs | ConvertTo-Json

    WriteContent -type $type -data $rbacsJson -count $rbacsCount -outPath $outPath
}

function GetUsersInTenant {
    param(
        [Parameter(Position = 0)]
        [String]
        $outPath = $null
    )
    
    Write-Host "List users in tenant"
    $users = az ad user list
    $usersCount = ($users | ConvertFrom-Json).Count
    $type = "users"

    WriteContent -type $type -data $users -count $usersCount -outPath $outPath
}

# TODO: Find better way to carry this out
$functions_threaded = {
    function TestFunc{
        Param(
            $groupOId
        )
        # List user members
        $members = az ad group member list -g $groupOId | ConvertFrom-Json
        # List group members
        $groupMembers = az ad group get-member-groups -g $groupOId
    
        [System.Collections.ArrayList]$membersIds = New-Object System.Collections.ArrayList 
        foreach($member in $members){
            $memberId = $member.objectId
            if ($null -ne $member.onPremisesSecurityIdentifier){
                $memberId = $member.onPremisesSecurityIdentifier
            }

            $i = $membersIds.Add([PSCustomObject]@{
                MemberId = $memberId
                MemberType = "User"
            })
        }

        foreach($member in $groupMembers){
            $memberId = $member.objectId
            if ($null -ne $member.onPremisesSecurityIdentifier){
                $memberId = $member.onPremisesSecurityIdentifier
            }

            $i = $membersIds.Add([PSCustomObject]@{
                MemberId = $memberId
                MemberType = "Group"
            })
        }

        return $membersIds
    }
}

function GetGroupsInTenant {
    param(
        [Parameter(Position = 0)]
        [String]
        $outPath = $null
    )

    Write-Host "List groups in tenant"
    # TODO: Edit group object on job end
    $groups = az ad group list | ConvertFrom-Json

    # List members per group
    for($i=0; $i -lt $groups.Count; $i++){
        $perc = ($i / $groups.Count) * 100
        Write-Progress -Activity "List groups" -Status "Group: $group" -PercentComplete $perc
        
        # Check if not over max threads threshold
        while ( (Get-Job -State Running ).Count -ge 20){
            Start-Sleep 20
        }

        $groupId = $groups[$i].objectId
        # Set job ID
        $name = "Members"+$i
        # Start thread for quering group
        Start-Job -Name $name -InitializationScript $functions_threaded -ScriptBlock {TestFunc -groupOId $using:groupId}
    }

    # Check all queries ended
    while((Get-Job -State Running ).Count -ne 0){
        Start-Sleep 20
    }

    # Add members for groups based on jobs output
    for($i=0; $i -lt $groups.Count; $i++){
        # Set job ID
        $name = "Members"+$i
        $membersIds = (Get-Job -Name $name | Receive-Job -Wait -AutoRemoveJob)
        $groups[$i] | Add-Member -MemberType NoteProperty -Name Members -Value $membersIds -Force
    }

    $groupsJson = $groups | ConvertTo-Json -Depth 3
    $groupsCount = $groups.Count
    $type = "groups"

    WriteContent -type $type -data $groupsJson -count $groupsCount -outPath $outPath
}

function GetServicePrincipalsInTenant {
    param(
        [Parameter(Position = 0)]
        [String]
        $outPath = $null
    )
    
    Write-Host "List Enterprise Application in tenant"
    # TODO: Get-AzureADServicePrincipal
    $sps = az ad sp list --all
    $spsCount = ($sps | ConvertFrom-Json).Count
    # $type = "CloudSPs"
    $type = "CloudRoles"

    WriteContent -type $type -data $sps -count $spsCount -outPath $outPath
}

# Get ServicePrincipal Role Assignments
function GetRoleAssignmentsInTenant {
    param(
        [Parameter(Position = 0)]
        [String]
        $outPath = $null
    )

    Write-host "Enumerating role assignments"

    [System.Collections.ArrayList]$ras = New-Object System.Collections.ArrayList 
    $sps = az ad sp list --all | ConvertFrom-Json
    $users = az ad user list | ConvertFrom-Json
    $groups = az ad group list | ConvertFrom-Json

    # Get Azure AD role assignments for each Service Principal
    $i = 0
    foreach($sp in $sps) {
        $perc = ($i / $sps.Count) *100
        Write-Progress -Activity "Get Role assignments" -Status "SP: $sp" -PercentComplete $perc
        $ras += Get-AzureADServiceAppRoleAssignment -ObjectId $sp.objectId
        $i++
    }

    # For each role assignment replace objectId to onPremisesSecurityId
    foreach($ra in $ras){
        $user = $users | Where-Object {$_.objectId -eq $ra.PrincipalId}
        $group = $groups | Where-Object {$_.objectId -eq $ra.PrincipalId}
        if ($user) {$ra | Add-Member -MemberType NoteProperty -Name PrincipalSID -Value $u1.onPremisesSecurityIdentifier}
        if ($group) {$ra | Add-Member -MemberType NoteProperty -Name PrincipalSID -Value $g1.onPremisesSecurityIdentifier}
        
    }

    $rasJson = $ras | ConvertTo-Json
    $rasCount = $ras.Count
    $type = "CloudRAs"
    WriteContent -type $type -data $rasJson -count $rasCount -outPath $outPath
}

function GetADRoleAssignmentsInTenant {
    param(
        [Parameter(Position = 0)]
        [String]
        $outPath = $null
    )
    
    Write-Host "Get Azure AD role assignments"
    
    $AADRoles = Get-AzureADDirectoryRole
    foreach($role in $AADRoles){
        $members = Get-AzureADDirectoryRoleMember -ObjectId $role.ObjectId
        if ($members -isnot [array]){$members = @($members)}
        $role | Add-Member -MemberType NoteProperty -Name Members -Value $members
    }
    $AADRolesJson = $AADRoles | ConvertTo-Json -Depth 4
    $AADRolesCount = $AADRoles.Count
    $type = "CloudAADRAs"

    WriteContent -type $type -data $AADRolesJson -count $AADRolesCount -outPath $outPath
}

function GetApplicationsInTenant {
    param(
        [Parameter(Position = 0)]
        [String]
        $outPath = $null
    )
    
    Write-Host "Enumerating App registrations"

    $apps = az ad app list | ConvertFrom-Json
    $appsCount = $apps.Count

    # List owners of each application
    $i = 0
    foreach($app in $apps){
        $perc = ($i/$appsCount) * 100
        Write-Progress -Activity "Application owners" -Status "Application: $app" -PercentComplete $perc

        $owners = Get-AzureADApplicationOwner -ObjectId $app.objectId
        if ($owners -isnot [array]){$owners = @($owners)}
        $apps[$i] | Add-Member -MemberType NoteProperty -Name Owners -Value $owners
        $i++
    }
    $appsJson = $apps | ConvertTo-Json -Depth 6
    $type = "CloudApps"
    
    WriteContent -type $type -data $appsJson -count $appsCount -outPath $outPath
}

function TenantEnum {
    param (
        [Parameter(Position = 0)]
        [ValidateNotNullOrEmpty()]
        [String]
        $tenant = $null,
        
        [Parameter(Position = 1)]
        [String]
        $path = $null
    )

    TenantLogin -tenantId $tenant

    # Azure AD Role Assignments
    GetADRoleAssignmentsInTenant -outPath $path

    # Get Users
    GetUsersInTenant -outPath $path

    # Get Groups
    GetGroupsInTenant -outPath $path

    # App Registration
    GetApplicationsInTenant -outPath $path

    # Enterprise App (service principals)
    GetServicePrincipalsInTenant -outPath $path
    
    # Role Assignments
    GetRoleAssignmentsInTenant -outPath $path
    
    # Get Subscriptions
    GetSubscriptions -outPath $path

    # Get RBACs
    GetRBACsInSubscription -outPath $path

    # Get Resource Groups
    GetSubscriptionResourceGroups -outPath $path

    # Get VMs in subscription
    GetVMsInSubscription -outPath $path

    # Get NICs in subscription
    GetNICsInSubscription -outPath $path

    # Get NSG in subscription
    GetNSGsInSubscription -outPath $path

    # Get KeyVault in subscription
    GetKeyVaultsInSubscription -outPath $path

    # Get Managed Identities
    GetManagedIdentitiesInSubscription -outPath $path

    if($path -eq "") {
        $path = (Get-Location).Path
    }
    Compress-Archive -Path "$path\*.json" -DestinationPath "$path\Tenant_$tenant.zip"
    Remove-Item -Path "$path\*.json"
    
}

function Main {
    param (
        [Parameter(Position = 0)]
        [ValidateNotNullOrEmpty()]
        [String[]]
        $tenants = $null,
        
        [Parameter(Position = 1)]
        [String]
        $path = $null
    )
    
    foreach($tenant in $tenants) {
        # TODO: Add functionality to use cached credentials
        # Disconnect any azure instances connected
        az logout
        disconnect-azuread
        Write-Host "Enumerate tenant: $tenant"
        TenantEnum -tenant $tenant -path $path
    }
}
