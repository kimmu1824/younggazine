@echo off
rem Open younggazine studio as an https address inside your tailnet only (NOT public; no funnel).
rem First enable "Serve" once in the Tailscale admin page (the link this command prints if it is off).
"C:\Program Files\Tailscale\tailscale.exe" serve --bg --yes 3939
"C:\Program Files\Tailscale\tailscale.exe" serve status
echo.
echo Open the https://....ts.net address above on your phone (Tailscale app must be on).
echo To close: "C:\Program Files\Tailscale\tailscale.exe" serve reset
pause
