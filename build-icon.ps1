$ErrorActionPreference='Stop'
Add-Type -AssemblyName PresentationCore,PresentationFramework,WindowsBase
$assetDirectory=Join-Path $PSScriptRoot 'source\assets'
$drawing=[Windows.Markup.XamlReader]::Parse([IO.File]::ReadAllText((Join-Path $assetDirectory 'LofreeHUB.xaml')))
$sizes=@(256,128,64,48,32,24,20,16)
$frames=foreach($size in $sizes){
 $visual=New-Object Windows.Media.DrawingVisual
 $drawingContext=$visual.RenderOpen()
 $drawingContext.DrawImage($drawing,(New-Object Windows.Rect(0,0,$size,$size)))
 $drawingContext.Close()
 $bitmap=New-Object Windows.Media.Imaging.RenderTargetBitmap($size,$size,96,96,[Windows.Media.PixelFormats]::Pbgra32)
 $bitmap.Render($visual)
 $encoder=New-Object Windows.Media.Imaging.PngBitmapEncoder
 $encoder.Frames.Add([Windows.Media.Imaging.BitmapFrame]::Create($bitmap))
 $stream=New-Object IO.MemoryStream
 $encoder.Save($stream)
 $bytes=$stream.ToArray();$stream.Dispose()
 if($size -eq 256){[IO.File]::WriteAllBytes((Join-Path $assetDirectory 'LofreeHUB.png'),$bytes)}
 [pscustomobject]@{Size=$size;Bytes=$bytes}
}
$file=[IO.File]::Create((Join-Path $assetDirectory 'LofreeHUB.ico'))
$writer=New-Object IO.BinaryWriter($file)
try{
 $writer.Write([uint16]0);$writer.Write([uint16]1);$writer.Write([uint16]$frames.Count)
 $offset=6+16*$frames.Count
 foreach($frame in $frames){
  $dimension=if($frame.Size -eq 256){0}else{$frame.Size}
  $writer.Write([byte]$dimension);$writer.Write([byte]$dimension);$writer.Write([byte]0);$writer.Write([byte]0)
  $writer.Write([uint16]1);$writer.Write([uint16]32);$writer.Write([uint32]$frame.Bytes.Length);$writer.Write([uint32]$offset)
  $offset+=$frame.Bytes.Length
 }
 foreach($frame in $frames){$writer.Write([byte[]]$frame.Bytes)}
}finally{$writer.Dispose()}
Write-Output 'Built LofreeHUB.ico (16/20/24/32/48/64/128/256 px)'
