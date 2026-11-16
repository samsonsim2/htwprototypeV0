Add-Type -AssemblyName System.Drawing

$imageRoot = Join-Path $PSScriptRoot '../src/assets/images'
$outputRoot = Join-Path $imageRoot 'cards'
New-Item -ItemType Directory -Path $outputRoot -Force | Out-Null
$names = @('DSC04671.jpg', 'DSC04692.jpg', 'DSC04667.jpg', 'DSC04668.jpg', 'DSC04663.jpg', 'DSC00005.jpg', 'DSC04674.jpg', 'RestStop.jpg', 'DSC04538.JPG', 'macritchie-viaduct-underpass.jpg', 'DSC04559.JPG')
$encoder = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object MimeType -eq 'image/jpeg'
$parameters = [System.Drawing.Imaging.EncoderParameters]::new(1)
$parameters.Param[0] = [System.Drawing.Imaging.EncoderParameter]::new([System.Drawing.Imaging.Encoder]::Quality, [long]70)
$totalBefore = 0
$totalAfter = 0
foreach ($name in $names) {
    $source = Get-Item -LiteralPath (Join-Path $imageRoot $name)
    $image = [System.Drawing.Image]::FromFile($source.FullName)
    $bitmap = [System.Drawing.Bitmap]::new(600, 400)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    try {
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $cropWidth = [math]::Min($image.Width, $image.Height * 1.5)
        $cropHeight = $cropWidth / 1.5
        $cropX = ($image.Width - $cropWidth) / 2
        # Match the existing lower framing of the stairs card.
        $cropY = ($image.Height - $cropHeight) * $(if ($name -eq 'DSC04671.jpg') { 0.8 } else { 0.5 })
        $graphics.DrawImage($image, [System.Drawing.Rectangle]::new(0, 0, 600, 400), [single]$cropX, [single]$cropY, [single]$cropWidth, [single]$cropHeight, [System.Drawing.GraphicsUnit]::Pixel)
        $output = Join-Path $outputRoot (([System.IO.Path]::GetFileNameWithoutExtension($name)) + '.jpg')
        $bitmap.Save($output, $encoder, $parameters)
        $saved = Get-Item -LiteralPath $output
        $totalBefore += $source.Length
        $totalAfter += $saved.Length
        '{0}: {1:N0} KB -> {2:N0} KB' -f $name, ($source.Length / 1KB), ($saved.Length / 1KB)
    } finally {
        $graphics.Dispose()
        $bitmap.Dispose()
        $image.Dispose()
    }
}
$parameters.Dispose()
'Total: {0:N2} MB -> {1:N2} MB ({2:N1}% smaller)' -f ($totalBefore / 1MB), ($totalAfter / 1MB), (100 * (1 - $totalAfter / $totalBefore))

