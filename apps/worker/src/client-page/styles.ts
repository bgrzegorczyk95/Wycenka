/** Inline CSS for the client page (Klient / KlientDesktop / KlientAkceptacja / KlientPytanie mockups). */
export const CLIENT_CSS = `
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:#FFFFFF;color:#1C2430;font:16px/1.45 Inter,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;-webkit-font-smoothing:antialiased}
a{color:inherit}
.wrap{max-width:560px;margin:0 auto;padding:0 20px 28px}
.top{display:flex;align-items:center;gap:14px;padding:20px;border-bottom:1px solid #E3DED4}
.top-inner{max-width:560px;margin:0 auto;display:flex;align-items:center;gap:14px;width:100%}
.badge{width:52px;height:52px;flex-shrink:0;border-radius:12px;background:#1C2430;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:20px;overflow:hidden}
.badge img{width:100%;height:100%;object-fit:cover}
.company{font-weight:600;font-size:17px;margin:0}
.meta{margin:2px 0 0;color:#5A6372;font-size:14px}
h1{font-family:"Space Grotesk",Inter,system-ui,sans-serif;font-size:30px;line-height:1.15;letter-spacing:-.5px;margin:24px 0 8px}
.lead{margin:0 0 20px;color:#3F4856;font-size:16px}
.section-title{margin:24px 0 8px;font-size:13px;font-weight:600;letter-spacing:.8px;text-transform:uppercase;color:#5A6372}
.items{list-style:none;margin:0;padding:0}
.items li{display:flex;justify-content:space-between;gap:16px;padding:12px 0;border-bottom:1px solid #E3DED4}
.items .name{font-size:16px}
.items .qty{display:block;color:#5A6372;font-size:14px;margin-top:2px}
.items .value{font-weight:600;white-space:nowrap}
.totals{margin-top:20px;background:#F5F3EE;border-radius:16px;padding:16px 20px}
.totals .row{display:flex;justify-content:space-between;color:#3F4856;font-size:15px;margin:4px 0}
.totals .gross{display:flex;justify-content:space-between;align-items:baseline;border-top:1px solid #D5CFC3;margin-top:10px;padding-top:12px;font-weight:600}
.totals .gross strong{font-size:32px;letter-spacing:-.5px}
.terms{display:grid;grid-template-columns:auto 1fr;gap:6px 24px;margin:0;font-size:15px}
.terms dt{color:#5A6372}
.terms dd{margin:0}
.actions{display:flex;flex-direction:column;gap:12px;margin-top:28px}
.btn{display:flex;align-items:center;justify-content:center;min-height:56px;border-radius:14px;font:600 17px Inter,system-ui,sans-serif;text-decoration:none;border:1px solid #D5CFC3;background:#fff;color:#1C2430;cursor:pointer;width:100%;padding:0 16px}
.btn-accept{background:#1E6B34;border-color:#1E6B34;color:#fff;font-size:18px}
.btn-dark{background:#1C2430;border-color:#1C2430;color:#fff}
.btn-row{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.hint{margin:16px 0 0;color:#5A6372;font-size:13px;text-align:center}
.confirm{margin-top:24px;border:2px solid #1E6B34;border-radius:16px;padding:18px;background:#E3F2E7}
.confirm p{margin:0 0 14px;font-weight:600;font-size:17px}
.notice{margin:20px 0 0;padding:12px 14px;border-radius:12px;background:#E3F2E7;color:#1E6B34;font-size:15px}
.notice.warn{background:#FFF6E0;color:#6B4A12;border:1px solid #E9C77A}
.preview{background:#FFF6E0;color:#6B4A12;text-align:center;font-size:14px;padding:10px 16px;border-bottom:1px solid #E9C77A}
.footer{margin-top:28px;padding:16px 20px;border-top:1px solid #E3DED4;text-align:center;color:#5A6372;font-size:13px}
.done-icon{width:56px;height:56px;border-radius:28px;background:#E3F2E7;color:#1E6B34;display:flex;align-items:center;justify-content:center;font-size:28px;margin-top:28px}
.card{border:1px solid #E3DED4;border-radius:16px;padding:16px 18px;margin-top:20px}
.card .row{display:flex;justify-content:space-between;gap:12px;margin:4px 0;font-size:15px}
.card .row span:first-child{color:#5A6372}
label{display:block;font-size:13px;font-weight:600;color:#3F4856;margin:16px 0 6px}
textarea,input[type=tel]{width:100%;border:1px solid #D5CFC3;border-radius:12px;padding:12px 14px;font:16px Inter,system-ui,sans-serif;color:#1C2430;background:#fff}
textarea{min-height:120px;resize:vertical}
.chips{display:flex;flex-wrap:wrap;gap:8px}
.chip{min-height:44px;border:1px solid #D5CFC3;border-radius:999px;background:#fff;padding:0 14px;font:15px Inter,system-ui,sans-serif;color:#3F4856;cursor:pointer}
.hp{position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden}
.back{display:inline-flex;align-items:center;min-height:44px;color:#5A6372;text-decoration:none;font-size:15px;margin-top:8px}
.error{color:#C2410C;font-size:14px;margin:8px 0 0}
table.items-table{display:none}
@media (min-width:900px){
  .wrap{max-width:1080px;display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:40px;align-items:start}
  .wrap.single{display:block;max-width:560px}
  .top-inner{max-width:1080px}
  h1{font-size:40px;margin-top:36px}
  .items{display:none}
  table.items-table{display:table;width:100%;border-collapse:collapse;font-size:15px}
  .items-table th{text-align:left;font-size:12px;font-weight:600;letter-spacing:.8px;text-transform:uppercase;color:#5A6372;padding:10px 0;border-bottom:1px solid #E3DED4}
  .items-table td{padding:12px 0;border-bottom:1px solid #EEEAE2}
  .items-table .num{text-align:right;white-space:nowrap;padding-left:16px}
  .side{position:sticky;top:24px;margin-top:36px}
  .side .totals{margin-top:0}
}
@media print{
  .actions,.hint,.preview,.no-print{display:none!important}
  body{font-size:13px}
  .wrap{display:block!important;max-width:none}
  .items{display:none}
  table.items-table{display:table!important;width:100%;border-collapse:collapse}
  .items-table th,.items-table td{padding:6px 0;border-bottom:1px solid #ddd;text-align:left}
  .items-table .num{text-align:right}
}
`;
