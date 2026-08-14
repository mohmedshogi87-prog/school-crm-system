[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://+:3000/")
try {
    $listener.Start()
} catch {
    $listener = New-Object System.Net.HttpListener
    $listener.Prefixes.Add("http://localhost:3000/")
    $listener.Start()
}

Write-Host "Full-Stack Server listening on port 3000..."

$distPath = (Get-Item "dist").FullName

# In-memory storage for CRM data
$script:leads = New-Object System.Collections.ArrayList
$script:users = New-Object System.Collections.ArrayList

function Get-CleanId($item) {
    if ($null -eq $item) { return "" }
    try {
        if ($item.id) { return $item.id.ToString() }
    } catch {}
    try {
        if ($item.ID) { return $item.ID.ToString() }
    } catch {}
    return ""
}

# Seed default admin user
$adminUser = @{
    id = "1"
    name = "General Manager"
    email = "admin@gmis.edu"
    role = "admin"
    status = "active"
    needs_password_change = 0
}
[void]$script:users.Add($adminUser)

# Seed sample leads
$sampleLead1 = @{
    id = "lead_101"
    name = "Mohammed Al-Qahtani"
    phone = "+966501234567"
    grade = "G10"
    channel = "whatsapp"
    score = 95
    status = "new"
    student_nationality = "Saudi"
    student_passport = "A12345678"
    parent_name = "Ahmed Al-Qahtani"
    email = "ahmed@example.com"
    address = "Riyadh"
    notes = "Interested in admission"
    created_at = (Get-Date).ToString("o")
}
$sampleLead2 = @{
    id = "lead_102"
    name = "Sarah Mahmoud"
    phone = "+966507654321"
    grade = "G8"
    channel = "web"
    score = 88
    status = "following"
    student_nationality = "Egyptian"
    student_passport = "B98765432"
    parent_name = "Mahmoud Ali"
    email = "mahmoud@example.com"
    address = "Jeddah"
    notes = "Awaiting school visit"
    created_at = (Get-Date).ToString("o")
}
[void]$script:leads.Add($sampleLead1)
[void]$script:leads.Add($sampleLead2)

while ($listener.IsListening) {
    try {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        # CORS Headers
        $response.AddHeader("Access-Control-Allow-Origin", "*")
        $response.AddHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, DELETE")
        $response.AddHeader("Access-Control-Allow-Headers", "Content-Type, Authorization")

        if ($request.HttpMethod -eq "OPTIONS") {
            $response.StatusCode = 200
            $response.Close()
            continue
        }

        $rawUrl = $request.Url.LocalPath

        # Handle API endpoints
        if ($rawUrl.StartsWith("/api/") -or $rawUrl.StartsWith("/auth/")) {
            $response.ContentType = "application/json; charset=utf-8"
            
            # Read JSON body if present
            $bodyText = ""
            if ($request.HasEntityBody) {
                $reader = New-Object System.IO.StreamReader($request.InputStream, [System.Text.Encoding]::UTF8)
                $bodyText = $reader.ReadToEnd()
                $reader.Close()
            }

            # 1. Login API
            if ($rawUrl -eq "/api/auth/login" -or $rawUrl -eq "/auth/login") {
                $resData = @{
                    token = "gmis_jwt_token_2026_demo"
                    user = $adminUser
                }
                $json = $resData | ConvertTo-Json -Depth 5
                $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
                $response.StatusCode = 200
                $response.OutputStream.Write($bytes, 0, $bytes.Length)
                $response.Close()
                continue
            }

            # 2a. Single Lead DELETE / UPDATE API (must come before /api/leads)
            if ($rawUrl -match "^/api/leads/(.+)") {
                $leadId = $matches[1].Split('/')[0].Split('?')[0].Trim().ToLower()
                Write-Host "DELETING LEAD: rawUrl='$rawUrl' leadId='$leadId' leadsCountBefore='$($script:leads.Count)'"

                if ($script:leads -and $script:leads.Count -gt 0) {
                    for ($i = $script:leads.Count - 1; $i -ge 0; $i--) {
                        try {
                            $item = $script:leads[$i]
                            $itemId = (Get-CleanId $item).Trim().ToLower()
                            if ($itemId -eq $leadId) {
                                $script:leads.RemoveAt($i)
                            }
                        } catch {}
                    }
                }
                $json = '{"success":true,"message":"Lead deleted permanently"}'
                $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
                $response.StatusCode = 200
                $response.OutputStream.Write($bytes, 0, $bytes.Length)
                $response.Close()
                continue
            }

            # 2b. Leads GET / POST
            if ($rawUrl -eq "/api/leads") {
                if ($request.HttpMethod -eq "GET") {
                    foreach ($l in $script:leads) {
                        if (-not $l.name -or $l.name.ToString().Trim() -eq "") {
                            if ($l.PSObject.Properties['name']) {
                                $l.name = "Student Record"
                            } else {
                                $l | Add-Member -NotePropertyName "name" -NotePropertyValue "Student Record" -Force
                            }
                        }
                        if (-not $l.phone) {
                            if ($l.PSObject.Properties['phone']) {
                                $l.phone = ""
                            } else {
                                $l | Add-Member -NotePropertyName "phone" -NotePropertyValue "" -Force
                            }
                        }
                    }
                    $json = $script:leads | ConvertTo-Json -Depth 5
                    if (-not $json) { $json = "[]" }
                    $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
                    $response.StatusCode = 200
                    $response.OutputStream.Write($bytes, 0, $bytes.Length)
                    $response.Close()
                    continue
                }
                if ($request.HttpMethod -eq "POST") {
                    if ($bodyText) {
                        $newLead = $bodyText | ConvertFrom-Json
                        [void]$script:leads.Insert(0, $newLead)
                    }
                    $json = '{"success":true}'
                    $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
                    $response.StatusCode = 200
                    $response.OutputStream.Write($bytes, 0, $bytes.Length)
                    $response.Close()
                    continue
                }
            }

            # 3. Batch Student Import API
            if ($rawUrl -eq "/api/students/import-batch") {
                $importedCount = 0
                if ($bodyText) {
                    $importObj = $bodyText | ConvertFrom-Json
                    if ($importObj.records) {
                        foreach ($rec in $importObj.records) {
                            if (-not $rec.name -or $rec.name.ToString().Trim() -eq "") {
                                $rec | Add-Member -NotePropertyName "name" -NotePropertyValue "Student Record" -Force
                            }
                            [void]$script:leads.Insert(0, $rec)
                            $importedCount++
                        }
                    }
                }
                $resObj = @{
                    success = $true
                    imported = $importedCount
                    updated = 0
                    total = $importedCount
                }
                $json = $resObj | ConvertTo-Json -Depth 5
                $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
                $response.StatusCode = 200
                $response.OutputStream.Write($bytes, 0, $bytes.Length)
                $response.Close()
                continue
            }

            # 4. Users API
            if ($rawUrl -eq "/api/users") {
                $json = @($script:users) | ConvertTo-Json -Depth 5
                if (-not $json.Trim().StartsWith("[")) { $json = "[$json]" }
                $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
                $response.StatusCode = 200
                $response.OutputStream.Write($bytes, 0, $bytes.Length)
                $response.Close()
                continue
            }

            # 5. Visits API
            if ($rawUrl.StartsWith("/api/visits")) {
                if ($request.HttpMethod -eq "POST" -and $bodyText) {
                    try {
                        $vData = $bodyText | ConvertFrom-Json
                        if (-not $vData.id) { $vData | Add-Member -MemberType NoteProperty -Name id -Value ("visit_" + (Get-Date).Ticks) -Force }
                        if (-not $vData.status) { $vData | Add-Member -MemberType NoteProperty -Name status -Value "pending" -Force }
                        [void]$script:visits.Insert(0, $vData)
                    } catch {}
                }
                $json = $script:visits | ConvertTo-Json -Depth 5
                if (-not $json) { $json = "[]" }
                $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
                $response.StatusCode = 200
                $response.OutputStream.Write($bytes, 0, $bytes.Length)
                $response.Close()
                continue
            }

            # 6. Knowledge Base API
            if ($rawUrl.StartsWith("/api/kb")) {
                $json = "[]"
                $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
                $response.StatusCode = 200
                $response.OutputStream.Write($bytes, 0, $bytes.Length)
                $response.Close()
                continue
            }

            # 7. Auto Replies API
            if ($rawUrl.StartsWith("/api/auto-replies")) {
                $json = "[]"
                $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
                $response.StatusCode = 200
                $response.OutputStream.Write($bytes, 0, $bytes.Length)
                $response.Close()
                continue
            }

            # 8. Stats API for Dashboard & RealAnalytics
            if ($rawUrl.StartsWith("/api/stats")) {
                $totalL = $script:leads.Count

                $gradeMap = @{}
                $natMap = @{}
                $addrMap = @{}
                $chanMap = @{}

                $newCount = 0
                $followingCount = 0
                $interestedCount = 0
                $registeredCount = 0
                $coldCount = 0

                foreach ($l in $script:leads) {
                    # Grade
                    $g = ""
                    try {
                        if ($l.grade) { $g = $l.grade.ToString() }
                        elseif ($l.student_grade) { $g = $l.student_grade.ToString() }
                    } catch {}
                    if (-not $g) { $g = "Unspecified Grade" }
                    if (-not $gradeMap.ContainsKey($g)) { $gradeMap[$g] = 0 }
                    $gradeMap[$g]++

                    # Nationality
                    $nat = ""
                    try {
                        if ($l.nationality) { $nat = $l.nationality.ToString() }
                        elseif ($l.student_nationality) { $nat = $l.student_nationality.ToString() }
                    } catch {}
                    if (-not $nat) { $nat = "Saudi" }
                    if (-not $natMap.ContainsKey($nat)) { $natMap[$nat] = 0 }
                    $natMap[$nat]++

                    # Address
                    $addr = ""
                    try {
                        if ($l.address) { $addr = $l.address.ToString() }
                    } catch {}
                    if (-not $addr) { $addr = "Riyadh" }
                    if (-not $addrMap.ContainsKey($addr)) { $addrMap[$addr] = 0 }
                    $addrMap[$addr]++

                    # Channel
                    $ch = ""
                    try {
                        if ($l.channel) { $ch = $l.channel.ToString() }
                    } catch {}
                    if (-not $ch) { $ch = "web" }
                    if (-not $chanMap.ContainsKey($ch)) { $chanMap[$ch] = 0 }
                    $chanMap[$ch]++

                    # Status / Funnel
                    $st = ""
                    try {
                        if ($l.status) { $st = $l.status.ToString().Trim().ToLower() }
                    } catch {}
                    switch ($st) {
                        "registered"  { $registeredCount++; break }
                        "interested"  { $interestedCount++; break }
                        "following"   { $followingCount++; break }
                        "cold"        { $coldCount++; break }
                        default       { $newCount++; break }
                    }
                }

                $gradeDistribution = @()
                foreach ($k in $gradeMap.Keys) { $gradeDistribution += @{ grade = $k; count = $gradeMap[$k] } }

                $nationalityDistribution = @()
                foreach ($k in $natMap.Keys) { $nationalityDistribution += @{ nationality = $k; count = $natMap[$k] } }

                $addressDistribution = @()
                foreach ($k in $addrMap.Keys) { $addressDistribution += @{ address = $k; count = $addrMap[$k] } }

                $channelData = @()
                foreach ($k in $chanMap.Keys) { $channelData += @{ name = $k; value = $chanMap[$k] } }

                $denom = [Math]::Max($totalL, 1)
                $schedRateVal = [Math]::Round(($script:visits.Count / $denom) * 100)
                $regRateVal   = [Math]::Round(($registeredCount / $denom) * 100)
                $actRateVal   = [Math]::Round((($interestedCount + $registeredCount) / $denom) * 100)

                $conversionMetrics = @{
                    scheduledRate  = "$schedRateVal%"
                    registeredRate = "$regRateVal%"
                    activeRate     = "$actRateVal%"
                }

                $funnel = @{
                    newLeads        = $newCount
                    followingLeads  = $followingCount
                    interestedLeads = $interestedCount
                    registeredLeads = $registeredCount
                    coldLeads       = $coldCount
                }

                $baseL = [Math]::Max(1, [Math]::Floor($totalL / 7))
                $weekData = @(
                    @{ day = "Sun"; name = "Sun"; leads = ($baseL + 2); conv = [Math]::Max(1, $registeredCount) },
                    @{ day = "Mon"; name = "Mon"; leads = ($baseL + 4); conv = [Math]::Max(1, $registeredCount) },
                    @{ day = "Tue"; name = "Tue"; leads = ($baseL + 1); conv = [Math]::Max(1, $registeredCount) },
                    @{ day = "Wed"; name = "Wed"; leads = ($baseL + 5); conv = [Math]::Max(1, $registeredCount) },
                    @{ day = "Thu"; name = "Thu"; leads = ($baseL + 3); conv = [Math]::Max(1, $registeredCount) },
                    @{ day = "Fri"; name = "Fri"; leads = ($baseL);     conv = [Math]::Max(0, $registeredCount) },
                    @{ day = "Sat"; name = "Sat"; leads = ($baseL + 2); conv = [Math]::Max(1, $registeredCount) }
                )

                $statsObj = @{
                    totalLeads = $totalL
                    newToday = $newCount
                    upcomingVisits = $script:visits.Count
                    visitsBooked = $script:visits.Count
                    hotLeads = $interestedCount
                    recentLeads = $script:leads
                    gradeDistribution = $gradeDistribution
                    nationalityDistribution = $nationalityDistribution
                    addressDistribution = $addressDistribution
                    channelData = $channelData
                    conversionMetrics = $conversionMetrics
                    funnel = $funnel
                    weekData = $weekData
                }

                $json = $statsObj | ConvertTo-Json -Depth 5
                $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
                $response.StatusCode = 200
                $response.OutputStream.Write($bytes, 0, $bytes.Length)
                $response.Close()
                continue
            }

            # Fallback for any other API route
            $json = '{"success":true}'
            $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
            $response.StatusCode = 200
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
            $response.Close()
            continue
        }

        # Static File Serving & SPA Fallback
        $cleanPath = $rawUrl.TrimStart('/')
        if ([string]::IsNullOrWhiteSpace($cleanPath)) {
            $cleanPath = "index.html"
        }

        $filePath = Join-Path $distPath $cleanPath

        if (-not (Test-Path $filePath -PathType Leaf)) {
            $filePath = Join-Path $distPath "index.html"
        }

        $bytes = [System.IO.File]::ReadAllBytes($filePath)
        $ext = [System.IO.Path]::GetExtension($filePath).ToLower()

        switch ($ext) {
            ".html" { $response.ContentType = "text/html; charset=utf-8" }
            ".js"   { $response.ContentType = "application/javascript; charset=utf-8" }
            ".css"  { $response.ContentType = "text/css; charset=utf-8" }
            ".svg"  { $response.ContentType = "image/svg+xml" }
            ".png"  { $response.ContentType = "image/png" }
            ".jpeg" { $response.ContentType = "image/jpeg" }
            ".jpg"  { $response.ContentType = "image/jpeg" }
            ".json" { $response.ContentType = "application/json; charset=utf-8" }
            default { $response.ContentType = "application/octet-stream" }
        }

        $response.ContentLength64 = $bytes.Length
        $response.OutputStream.Write($bytes, 0, $bytes.Length)
        $response.Close()
    } catch {
        try { $response.Close() } catch {}
    }
}
