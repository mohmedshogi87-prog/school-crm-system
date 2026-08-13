$filePath = "dist/assets/index-CJR2Gsgz.js"
$text = [System.IO.File]::ReadAllText($filePath, [System.Text.Encoding]::UTF8)

# 1. Remove topbar garbled button injection around index 213135
$topbarKey = 'children:"EN"})]}),'
$idx1 = $text.IndexOf($topbarKey)
if ($idx1 -gt 0) {
    $endIdx1 = $text.IndexOf('(0,x.jsxs)(`button`,{className:`btn', $idx1)
    if ($endIdx1 -gt $idx1) {
        $text = $text.Substring(0, $idx1 + $topbarKey.Length) + $text.Substring($endIdx1)
        Write-Host "CLEANED_TOPBAR_BUTTON"
    }
}

# 2. Update CRM header button around Export CSV
$exportKey = ':`Export CSV`]}),'
$idx2 = $text.IndexOf($exportKey)
if ($idx2 -gt 0) {
    $endIdx2 = $text.IndexOf('(0,x.jsxs)(`button`,{className:`btn btn-primary btn-sm`', $idx2)
    if ($endIdx2 -gt $idx2) {
        # Clean button with JS Unicode Escapes for Arabic/English language adaptation
        $cleanBtn = ':`Export CSV`]}),(0,x.jsxs)("button",{className:"btn btn-outline btn-sm",style:{color:"#10b981",borderColor:"rgba(16,185,129,0.4)",background:"rgba(16,185,129,0.08)",fontWeight:700,display:"inline-flex",alignItems:"center",gap:"6px"},onClick:function(){if(window.openImportModal)window.openImportModal();},children:[(0,x.jsx)(be,{size:16}),e?"\uD83D\uDCE5 \u0627\u0633\u062A\u064A\u0631\u0627\u062F \u0627\u0644\u0637\u0644\u0627\u0628":"\uD83D\uDCE5 Import Students"]}),'
        
        $text = $text.Substring(0, $idx2 + $exportKey.Length) + $cleanBtn + $text.Substring($endIdx2)
        Write-Host "CLEANED_AND_PATCHED_CRM_HEADER_BUTTON"
    }
}

[System.IO.File]::WriteAllText($filePath, $text, [System.Text.Encoding]::UTF8)
