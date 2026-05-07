#!/usr/bin/env python3
"""Build a consolidated Transaction Portfolio xlsx with 11 transaction summaries."""

from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
from datetime import datetime

# ============ BRAND COLORS ============
INDIGO_DEEP = "4338CA"
PURPLE = "8B5CF6"
INDIGO_NAVY = "312E81"
LAVENDER = "DDD6FE"
PURPLE_TINT = "F5F3FF"
LIGHT_GRAY = "F3F4F6"
DARK_GRAY = "374151"
WHITE = "FFFFFF"

# Status colors
COLOR_PAST_DUE = "991B1B"
COLOR_URGENT = "EF4444"
COLOR_WARNING = "F59E0B"
COLOR_ON_TRACK = "10B981"
COLOR_CLOSED = "6B7280"
COLOR_CANCELLED = "7F1D1D"
COLOR_ON_HOLD = "F97316"


def fill(color):
    return PatternFill("solid", start_color=color, end_color=color)


def border_thin(color="D1D5DB"):
    s = Side(style="thin", color=color)
    return Border(left=s, right=s, top=s, bottom=s)


def style_title_bar(ws, row, text, num_cols=4, bg=INDIGO_DEEP, fg=WHITE, size=14):
    ws.merge_cells(start_row=row, start_column=1, end_row=row, end_column=num_cols)
    cell = ws.cell(row=row, column=1, value=text)
    cell.font = Font(name="Arial", size=size, bold=True, color=fg)
    cell.fill = fill(bg)
    cell.alignment = Alignment(horizontal="center", vertical="center")
    ws.row_dimensions[row].height = 32


def style_section_header(ws, row, text, num_cols=4, bg=INDIGO_NAVY):
    ws.merge_cells(start_row=row, start_column=1, end_row=row, end_column=num_cols)
    cell = ws.cell(row=row, column=1, value=text)
    cell.font = Font(name="Arial", size=11, bold=True, color=WHITE)
    cell.fill = fill(bg)
    cell.alignment = Alignment(horizontal="left", vertical="center", indent=1)
    ws.row_dimensions[row].height = 22


def style_field_row(ws, row, label, value, num_cols=4):
    """Two-column field row: label in col 1, value spans cols 2-num_cols"""
    label_cell = ws.cell(row=row, column=1, value=label)
    label_cell.font = Font(name="Arial", size=10, bold=True, color=DARK_GRAY)
    label_cell.fill = fill(LIGHT_GRAY)
    label_cell.alignment = Alignment(horizontal="left", vertical="center", indent=1)
    label_cell.border = border_thin()

    if num_cols > 2:
        ws.merge_cells(start_row=row, start_column=2, end_row=row, end_column=num_cols)
    val_cell = ws.cell(row=row, column=2, value=value if value else "—")
    val_cell.font = Font(name="Arial", size=10, color=DARK_GRAY)
    val_cell.fill = fill(WHITE)
    val_cell.alignment = Alignment(horizontal="left", vertical="center", indent=1, wrap_text=True)
    val_cell.border = border_thin()
    ws.row_dimensions[row].height = 20


def style_spacer(ws, row, num_cols=4, height=6):
    for col in range(1, num_cols + 1):
        ws.cell(row=row, column=col).fill = fill(WHITE)
    ws.row_dimensions[row].height = height


def get_status_color(status):
    s = (status or "").lower()
    if "past due" in s or "past_due" in s:
        return COLOR_PAST_DUE
    if "urgent" in s:
        return COLOR_URGENT
    if "warning" in s:
        return COLOR_WARNING
    if "on track" in s or "active" in s:
        return COLOR_ON_TRACK
    if "cancelled" in s:
        return COLOR_CANCELLED
    if "closed" in s:
        return COLOR_CLOSED
    if "on hold" in s:
        return COLOR_ON_HOLD
    return "9CA3AF"


# ============ TRANSACTION DATA ============
TRANSACTIONS = [
    {
        "short": "5024 Gambero Way",
        "address": "5024 Gambero Way Ave Maria, FL 34142",
        "agent_ref": "Serf",
        "tax_id": "56530040982",
        "price": "$630,000.00",
        "financing": "Conventional (45 days)",
        "effective": "Wednesday, Feb 18, 2026",
        "closing": "Tuesday, Jun 30, 2026",
        "side": "Listing Side (Serafin Sanchez)",
        "status": "🟢 ON TRACK — Day 78 of 132",
        "next": "Title Commitment — Jun 15, 2026 (39 days)",
        "sellers": "LISA SEMOY",
        "buyers": "DANIEL MINTER & JENNIFER MINTER",
        "lst_agent": "Serafin Sanchez",
        "lst_lic": "3103925",
        "lst_phone": "(305) 244-7373",
        "lst_email": "serftherealtor@yahoo.com",
        "lst_brokerage": "The Keyes Company",
        "lst_office": "4191 N.W. 107 Ave., Miami, FL 33178 • (305) 594-2600",
        "byr_agent": "Jim Carletta",
        "byr_lic": "—",
        "byr_phone": "(239) 510-8297",
        "byr_email": "jim@84realestate.com",
        "byr_brokerage": "84 Real Estate",
        "byr_office": "5078 Pope John Paul II Blvd., Ave Maria, FL 34142 • (239) 488-8484",
        "title_company": "The Law Offices of Robert L. Klucik",
        "title_contact": "Robert Klucik",
        "title_phone": "(239) 455-4529",
        "title_email": "RLK@avemarialawyer.com",
        "lo_company": "Preferred Rate",
        "lo_contact": "Mark Fein",
        "lo_phone": "(239) 784-7236",
        "lo_email": "mark.fein@preferredrate.com",
        "concessions": "",
        "milestones": [
            ("Effective Date", "Wed, Feb 18, 2026", "—"),
            ("Escrow Due", "Mon, Feb 23, 2026 — $10,000.00", "✅ Done"),
            ("Inspection Due", "Thu, Mar 5, 2026", "✅ Done"),
            ("Loan Application Due", "Mon, Feb 23, 2026", "✅ Done"),
            ("Loan Approval Due", "Mon, Apr 6, 2026", "✅ Done"),
            ("HOA Application", "Mon, Feb 23, 2026", "✅ Done"),
            ("HOA Approval", "Thu, Jun 25, 2026", "⏳ Pending"),
            ("Title Commitment", "Mon, Jun 15, 2026", "⏳ Pending"),
            ("Closing Date", "Tue, Jun 30, 2026", "—"),
        ],
    },
    {
        "short": "5105 Salerno St",
        "address": "5105 Salerno St Ave Maria, FL 34142",
        "agent_ref": "Serf",
        "tax_id": "56530011526",
        "price": "$440,000.00",
        "financing": "Conventional (45 days)",
        "effective": "Monday, Apr 6, 2026",
        "closing": "Friday, Jun 5, 2026",
        "side": "Both (Dual Agency — Serafin Sanchez)",
        "status": "🟢 ON TRACK — Day 31 of 60",
        "next": "Loan Approval Due — May 21, 2026 (14 days)",
        "sellers": "JACQUELINE A LEMKE & MARK A LEMKE",
        "buyers": "SALVATORE A GIORDANO & SHARON M GIORDANO",
        "lst_agent": "Serafin Sanchez",
        "lst_lic": "3103925",
        "lst_phone": "(305) 244-7373",
        "lst_email": "serftherealtor@yahoo.com",
        "lst_brokerage": "The Keyes Company",
        "lst_office": "4191 N.W. 107 Ave., Miami, FL 33178 • (305) 594-2600",
        "byr_agent": "Serafin Sanchez (Dual Agency)",
        "byr_lic": "3103925",
        "byr_phone": "(305) 244-7373",
        "byr_email": "serftherealtor@yahoo.com",
        "byr_brokerage": "The Keyes Company",
        "byr_office": "Same as listing",
        "title_company": "HomePartners Title Services",
        "title_contact": "Grisselle Roman",
        "title_phone": "(954) 604-6762",
        "title_email": "GRoman@homepartnerstitle.com",
        "title_address": "809 N. Flagler Avenue, Homestead, FL 33030",
        "escrow_company": "The Keyes Company",
        "escrow_email": "deals@keyes.com",
        "escrow_phone": "(305) 594-2600",
        "lo_company": "KYP Power",
        "lo_contact": "Bessy Mautner / Alex Garcia",
        "lo_phone": "(786) 389-2196",
        "lo_email": "bessy@kyppower.com / alex@kyppower.com",
        "concessions": "",
        "milestones": [
            ("Effective Date", "Mon, Apr 6, 2026", "—"),
            ("Escrow Due", "Thu, Apr 9, 2026 — $10,000.00", "✅ Done"),
            ("Additional Escrow Due", "Tue, Apr 21, 2026 — $10,000.00", "✅ Done"),
            ("Inspection Due", "Thu, Apr 16, 2026", "✅ Done"),
            ("Loan Application Due", "Mon, Apr 13, 2026", "✅ Done"),
            ("Loan Approval Due", "Thu, May 21, 2026", "⏳ Pending"),
            ("HOA Application", "Thu, Apr 16, 2026", "✅ Done"),
            ("HOA Approval", "Mon, Jun 1, 2026", "⏳ Pending"),
            ("Title Commitment", "Thu, May 21, 2026", "⏳ Pending"),
            ("Closing Date", "Fri, Jun 5, 2026", "—"),
        ],
    },
    {
        "short": "3265 NW 50 St (CASH)",
        "address": "3265 NW 50 St, Miami, FL 33142",
        "agent_ref": "AH (Angelique Hibbert)",
        "tax_id": "—",
        "price": "$410,000.00",
        "financing": "CASH",
        "effective": "Monday, Apr 6, 2026",
        "closing": "Friday, May 1, 2026",
        "side": "Listing Side (Angelique Hibbert)",
        "status": "❌ CANCELLED (manual override)",
        "next": "—",
        "sellers": "Raleigh Flowers Jr Trs, Flowers Family Revocable Tr, Ramona Flowers Trs",
        "buyers": "Mattiaza Lucia Hernandez & Felix Hernandez",
        "lst_agent": "Angelique Hibbert",
        "lst_lic": "—",
        "lst_phone": "786-262-5345",
        "lst_email": "angelique@ahgrouprealty.com",
        "lst_brokerage": "AH Group Realty",
        "lst_office": "—",
        "byr_agent": "Annia Garcia",
        "byr_lic": "—",
        "byr_phone": "(305) 345-6091",
        "byr_email": "soldbydelphi@gmail.com",
        "byr_brokerage": "Delphi Investment Realty",
        "byr_office": "—",
        "title_company": "The Title Experts of SFL & Escrow Services, LLC",
        "title_contact": "—",
        "title_phone": "(954) 505-4966",
        "title_email": "closings@titleexpertsfl.com",
        "title_address": "9050 Pines Blvd, Ste. 385 Pembroke Pines, FL 33024",
        "lo_company": "—",
        "lo_contact": "—",
        "lo_phone": "—",
        "lo_email": "—",
        "concessions": "",
        "milestones": [
            ("Effective Date", "Mon, Apr 6, 2026", "—"),
            ("Escrow Due", "Wed, Apr 8, 2026 — $10,000.00", "✅ Done"),
            ("Inspection Due", "Fri, Apr 10, 2026", "✅ Done"),
            ("Loan Application Due", "N/A (Cash)", "—"),
            ("Title Commitment", "Thu, Apr 16, 2026", "✅ Done"),
            ("Closing Date", "Fri, May 1, 2026", "—"),
        ],
        "notes": "Transaction marked Cancelled via manual status override.",
    },
    {
        "short": "1001 NW 148th St",
        "address": "1001 NW 148th St Miami, FL 33168",
        "agent_ref": "Carlitos (Carlos Brown)",
        "tax_id": "3021230011220",
        "price": "$580,000.00",
        "financing": "Conventional (21 days)",
        "effective": "Thursday, Apr 16, 2026",
        "closing": "Monday, Jun 1, 2026",
        "side": "Listing Side (Carlos Brown)",
        "status": "🔴 URGENT — Day 21 of 46",
        "next": "Loan Approval Due — May 14, 2026 (~7 days)",
        "sellers": "ORESTE CASH COVIL & TYRONE TERRELL WILLIAMS",
        "buyers": "RENATO ROJAS & KATHLEEN RIOS",
        "lst_agent": "Carlos Brown",
        "lst_lic": "3257719",
        "lst_phone": "305.778.8257",
        "lst_email": "carlosbrown@keyes.com",
        "lst_brokerage": "The Keyes Company",
        "lst_office": "2822 NE 187th St, Aventura, FL 33180 • 305.931.8920",
        "co_lst_agent": "Linda Julien",
        "co_lst_lic": "3296601",
        "co_lst_phone": "305.469.5039",
        "co_lst_email": "linda@onemegalopolis.com",
        "co_lst_brokerage": "Megalopolis, LLC",
        "co_lst_office": "1801 NE 123 St, Ste 314, North Miami, FL 33181 • 786.258.4848",
        "byr_agent": "Elba Rojas",
        "byr_lic": "3649544",
        "byr_phone": "786.525.8808",
        "byr_email": "elba.sellsmiami@gmail.com",
        "byr_brokerage": "Real Estate Sales Force",
        "byr_office": "814 Ponce De Leon Blvd, Coral Gables, FL 33134 • 305.392.1497",
        "title_company": "Title 2 You, LLC (Buyer Title)",
        "title_contact": "Michelle Becerra",
        "title_phone": "786.762.4179",
        "title_email": "info@title2you.com",
        "slr_title_company": "Title Experts of SFL & Escrow Services, LLC (Seller Title)",
        "slr_title_contact": "Nelta M. Monde",
        "slr_title_phone": "954.505.4966",
        "slr_title_email": "Nelta@TitleExpertsfl.com",
        "lo_company": "Citi Bank",
        "lo_contact": "Jose Haro",
        "lo_phone": "972.655.0582",
        "lo_email": "jose.haro@citi.com",
        "lp_company": "Citi Bank",
        "lp_contact": "Yuleisy Martinez",
        "lp_phone": "734.295.5295",
        "lp_email": "Yuleisy.martinez@citi.com",
        "concessions": "• Seller contributes $10,000 toward buyer's closing costs / prepaids\n• Elba Rojas (buyer's agent) gives buyer $5,000 toward closing costs\n• Seller agrees to additional $1,000 toward buyer's closing costs / prepaids",
        "milestones": [
            ("Effective Date", "Thu, Apr 16, 2026", "—"),
            ("Escrow Due", "Sun, Apr 19, 2026 — $3,000.00", "✅ Done"),
            ("Inspection Due", "Thu, Apr 23, 2026", "✅ Done"),
            ("Loan Application Due", "Tue, Apr 21, 2026", "✅ Done"),
            ("Loan Approval Due", "Thu, May 14, 2026 (Conventional)", "⏳ Pending"),
            ("Title Commitment", "Sun, May 17, 2026", "⏳ Pending"),
            ("Closing Date", "Mon, Jun 1, 2026", "—"),
        ],
    },
    {
        "short": "5502 Cassidy Ln",
        "address": "5502 Cassidy Ln Ave Maria, FL 34142",
        "agent_ref": "Serf",
        "tax_id": "73640101422",
        "price": "$359,000.00",
        "financing": "Conventional (28 days)",
        "effective": "Monday, Apr 20, 2026",
        "closing": "Friday, May 29, 2026",
        "side": "Listing Side (Serafin Sanchez)",
        "status": "🟢 ON TRACK — Day 17 of 39",
        "next": "Loan Approval Due — May 18, 2026 (11 days)",
        "sellers": "DARYL J RAMOS & MERCEDES RAMOS",
        "buyers": "CARL DAUGHERTY & ZAMIRA DAUGHERTY",
        "lst_agent": "Serafin Sanchez",
        "lst_lic": "3103925",
        "lst_phone": "(305) 244-7373",
        "lst_email": "serftherealtor@yahoo.com",
        "lst_brokerage": "The Keyes Company",
        "lst_office": "4191 N.W. 107 Ave., Miami, FL 33178 • (305) 594-2600",
        "byr_agent": "Doris M. Guzman",
        "byr_lic": "3439513",
        "byr_phone": "(305) 726-7250",
        "byr_email": "dorism.realtor@gmail.com",
        "byr_brokerage": "Brokernation Real Estate Doral",
        "byr_office": "2555 NW 102 Ave, Doral, FL 33172 • (305) 508-9893",
        "title_company": "First In Title (Buyer)",
        "title_contact": "Iliana Cardentey & Elsa Rodriguez",
        "title_phone": "(954) 349-4807",
        "title_email": "iliana.cardentey@firstintitle.com / elsa.rodriguez@firstintitle.com",
        "title_address": "2117 North Commerce Parkway, Weston, FL 33326",
        "slr_title_company": "Terra Title Corp (Seller)",
        "slr_title_contact": "Sabrina Gomez",
        "slr_title_phone": "(954) 771-1195",
        "slr_title_email": "sabrina@terratitlecorp.com",
        "slr_title_address": "1000 N. Hiatus Road, Ste 105, Pembroke Pines, FL 33026",
        "escrow_company": "National Trust Title Services",
        "escrow_phone": "(305) 710-6718",
        "escrow_email": "cristy@nationaltrusttitle.com",
        "lo_company": "TRUIST Mortgage",
        "lo_contact": "Maria Elena Llamo",
        "lo_phone": "(305) 332-4950",
        "lo_email": "maria.llamo@truist.com",
        "concessions": "",
        "milestones": [
            ("Effective Date", "Mon, Apr 20, 2026", "—"),
            ("Escrow Due", "Wed, Apr 22, 2026 — $5,000.00", "✅ Done"),
            ("Additional Escrow Due", "Thu, Apr 30, 2026 — $5,000.00", "✅ Done"),
            ("Inspection Due", "Thu, Apr 30, 2026", "✅ Done"),
            ("Loan Application Due", "Mon, Apr 27, 2026", "✅ Done"),
            ("Loan Approval Due", "Mon, May 18, 2026 (Conventional)", "⏳ Pending"),
            ("HOA Application", "Thu, Apr 30, 2026", "✅ Done"),
            ("HOA Approval", "Mon, May 25, 2026", "⏳ Pending"),
            ("Title Commitment", "Tue, May 19, 2026", "⏳ Pending"),
            ("Closing Date", "Fri, May 29, 2026", "—"),
        ],
    },
    {
        "short": "14051 SW 15th Ct",
        "address": "14051 SW 15th Court, Davie, FL 33325",
        "agent_ref": "Hilda (Hilda Mack)",
        "tax_id": "504015010155",
        "price": "$1,020,000.00",
        "financing": "VA (30 days)",
        "effective": "Monday, Apr 20, 2026",
        "closing": "Friday, Jun 5, 2026",
        "side": "Listing Side (Hilda Mack)",
        "status": "🟢 ON TRACK — Day 17 of 46",
        "next": "Loan Approval Due — May 20, 2026 (13 days)",
        "sellers": "ORLANDO JIMENEZ",
        "buyers": "DAWN WAGER & DAVID N WAGER",
        "lst_agent": "Hilda Mack",
        "lst_lic": "3147651",
        "lst_phone": "(954) 562-4273",
        "lst_email": "hvmack@hotmail.com",
        "lst_brokerage": "The Keyes Company",
        "lst_office": "1535 Three Village Rd, Weston, FL 33326 • (954) 389-3459",
        "byr_agent": "Rozita Rafat",
        "byr_lic": "3279776",
        "byr_phone": "(786) 571-6465",
        "byr_email": "rozirafat@gmail.com",
        "byr_brokerage": "Keller Williams Legacy",
        "byr_office": "1625 N. Commerce Pky, Weston, FL 33326 • (954) 358-6000",
        "title_company": "—",
        "title_contact": "—",
        "title_phone": "—",
        "title_email": "—",
        "lo_company": "CCM",
        "lo_contact": "Bobby Fountain",
        "lo_phone": "M: (954) 547-2852  •  D: (954) 312-3021",
        "lo_email": "bobby.fountain@ccm.com",
        "concessions": "",
        "milestones": [
            ("Effective Date", "Mon, Apr 20, 2026", "—"),
            ("Escrow Due", "Thu, Apr 23, 2026 — $10,000.00", "✅ Done"),
            ("Inspection Due", "Thu, Apr 30, 2026", "✅ Done"),
            ("Loan Application Due", "Mon, Apr 27, 2026", "✅ Done"),
            ("Loan Approval Due", "Wed, May 20, 2026 (VA)", "⏳ Pending"),
            ("Title Commitment", "Thu, May 21, 2026", "⏳ Pending"),
            ("Closing Date", "Fri, Jun 5, 2026", "—"),
        ],
    },
    {
        "short": "1912 S Ocean Dr #12C",
        "address": "1912 S Ocean Dr #12C, Hallandale Beach, FL 33009",
        "agent_ref": "Silvia (Silvia Pedrinelli Masci)",
        "tax_id": "514226C10430",
        "price": "$495,000.00",
        "financing": "CASH",
        "effective": "Thursday, Apr 23, 2026",
        "closing": "Thursday, Jun 4, 2026",
        "side": "Listing Side (Silvia Pedrinelli Masci)",
        "status": "🟢 ON TRACK — Day 14 of 42",
        "next": "Title Commitment — May 20, 2026 (~13 days)",
        "sellers": "GIMETTA HOLDINGS, LLC",
        "buyers": "IOWA RUIZ MARTINEZ",
        "lst_agent": "Silvia Pedrinelli Masci",
        "lst_lic": "3401657",
        "lst_phone": "(516) 508-6713",
        "lst_email": "silviamasci@keyes.com",
        "lst_brokerage": "The Keyes Company",
        "lst_office": "2822 NE 187th St, Aventura, FL 33160 • (305) 931-8920",
        "byr_agent": "Teresa Palacios & Fabian Palacios",
        "byr_lic": "BK659347 / SL3379213",
        "byr_phone": "(954) 643-7621 / (954) 643-8616",
        "byr_email": "team@palaciosre.com",
        "byr_brokerage": "Palacios Real Estate & Co",
        "byr_office": "6303 Blue Lagoon Dr, Miami, FL 33126 • (954) 251-0909",
        "title_company": "Law Offices of Robert J. Nemrow, P.A.",
        "title_contact": "Robert J. Nemrow, Esq.",
        "title_phone": "(954) 805-7203",
        "title_email": "bob@nemrowlaw.com",
        "title_address": "632 Huron Terr, Davie, FL 33331",
        "lo_company": "—",
        "lo_contact": "—",
        "lo_phone": "—",
        "lo_email": "—",
        "concessions": "",
        "milestones": [
            ("Effective Date", "Thu, Apr 23, 2026", "—"),
            ("Escrow Due", "Mon, Apr 27, 2026 — $25,000.00", "✅ Done"),
            ("Inspection Due", "Mon, May 4, 2026", "✅ Done"),
            ("HOA Application", "Tue, Apr 28, 2026", "✅ Done"),
            ("HOA Approval", "Mon, Jun 1, 2026", "⏳ Pending"),
            ("Title Commitment", "Wed, May 20, 2026", "⏳ Pending"),
            ("Closing Date", "Thu, Jun 4, 2026", "—"),
        ],
    },
    {
        "short": "705 Belmont Ln",
        "address": "705 Belmont Ln, North Lauderdale, FL 33068",
        "agent_ref": "Carlitos (Carlos Brown)",
        "tax_id": "494111AE0650",
        "price": "$250,000.00",
        "financing": "FHA (30 days)",
        "effective": "Friday, May 1, 2026",
        "closing": "Tuesday, Jun 16, 2026",
        "side": "Buyer Side (Carlos Brown)",
        "status": "🟢 ON TRACK — Day 6 of 46",
        "next": "Inspection Due — May 11, 2026 (~4 days)",
        "sellers": "VEROLI INVESTMENTS, LLC",
        "buyers": "DENISE PETER",
        "lst_agent": "Dirimo Chourio",
        "lst_lic": "3567753",
        "lst_phone": "786.702.3634",
        "lst_email": "Dirimorealty@gmail.com",
        "lst_brokerage": "Vesta Realty, LLC",
        "lst_office": "2875 NE 191 St, Aventura, FL 33180 • 786.248.1892",
        "byr_agent": "Carlos Brown",
        "byr_lic": "3257719",
        "byr_phone": "305.778.8257",
        "byr_email": "carlosbrown@keyes.com",
        "byr_brokerage": "The Keyes Company",
        "byr_office": "2822 NE 187th St, Aventura, FL 33180 • 305.931.8920",
        "co_byr_agent": "Brandon Jean Baptiste",
        "co_byr_lic": "3446306",
        "co_byr_phone": "786.878.2588",
        "co_byr_email": "brandonjeanbaptiste@keyes.com",
        "title_company": "Title Experts of SFL & Escrow Services, LLC",
        "title_contact": "Nelta M. Monde",
        "title_phone": "954.505.4966",
        "title_email": "Nelta@TitleExpertsfl.com",
        "lo_company": "Level Mortgage",
        "lo_contact": "Mike Molina",
        "lo_phone": "786.719.7117",
        "lo_email": "Mike@levelmtg.com",
        "concessions": "• Seller agrees to 4% concession of purchase price toward buyer's closing costs / prepaids",
        "milestones": [
            ("Effective Date", "Fri, May 1, 2026", "—"),
            ("Escrow Due", "Wed, May 6, 2026 — $3,500.00", "✅ Done"),
            ("Inspection Due", "Mon, May 11, 2026", "⏳ Pending"),
            ("Loan Application Due", "Wed, May 6, 2026", "✅ Done"),
            ("Loan Approval Due", "Sun, May 31, 2026 (FHA)", "⏳ Pending"),
            ("HOA Application", "Wed, May 6, 2026", "✅ Done"),
            ("HOA Approval", "Thu, Jun 11, 2026", "⏳ Pending"),
            ("Title Commitment", "Mon, Jun 1, 2026", "⏳ Pending"),
            ("Closing Date", "Tue, Jun 16, 2026", "—"),
        ],
    },
    {
        "short": "6859 NW 17th Ave",
        "address": "6859 NW 17th Ave, Miami, FL 33147-7472",
        "agent_ref": "Carlitos (Carlos Brown)",
        "tax_id": "01-3114-018-0900",
        "price": "$409,900.00",
        "financing": "FHA (45 days)",
        "effective": "Sunday, May 3, 2026",
        "closing": "Tuesday, Jun 30, 2026",
        "side": "Buyer Side (Carlos Brown)",
        "status": "🟢 ON TRACK — Day 4 of 58",
        "next": "Inspection Due — May 8, 2026 (~1 day)",
        "sellers": "3N INVESTMENT GROUP LLC",
        "buyers": "MARIE PIERRE  •  Email: Packy509@gmail.com  •  Phone: 786.955.3543",
        "lst_agent": "Luisa Agudelo",
        "lst_lic": "3391351",
        "lst_phone": "954.305.8758",
        "lst_email": "transactions@kassasdeals.com",
        "lst_brokerage": "Realty One Group Evolution",
        "lst_office": "2822 NW 79th Ave, Miami, FL 33122 • 786.477.4715",
        "byr_agent": "Carlos Brown",
        "byr_lic": "3257719",
        "byr_phone": "305.778.8257",
        "byr_email": "carlosbrown@keyes.com",
        "byr_brokerage": "The Keyes Company",
        "byr_office": "2822 NE 187th St, Aventura, FL 33180 • 305.931.8920",
        "title_company": "Title Experts of SFL & Escrow Services",
        "title_contact": "Nelta M. Monde",
        "title_phone": "954-505-4966",
        "title_email": "Nelta@titleexpertsfl.com",
        "lo_company": "Level Mortgage",
        "lo_contact": "Mike Molina",
        "lo_phone": "786.719.7117",
        "lo_email": "Mike@levelmtg.com",
        "concessions": "",
        "milestones": [
            ("Effective Date", "Sun, May 3, 2026", "—"),
            ("Escrow Due", "Wed, May 6, 2026 — $2,500.00", "✅ Done"),
            ("Inspection Due", "Fri, May 8, 2026", "⏳ Pending"),
            ("Loan Application Due", "Fri, May 8, 2026", "✅ Done"),
            ("Loan Approval Due", "Wed, Jun 17, 2026 (FHA)", "⏳ Pending"),
            ("Title Commitment", "Mon, Jun 15, 2026", "⏳ Pending"),
            ("Closing Date", "Tue, Jun 30, 2026", "—"),
        ],
    },
    {
        "short": "1946 Harbor View Cir",
        "address": "1946 Harbor View Cir, Weston, FL 33327",
        "agent_ref": "Martha (Martha Martinez)",
        "tax_id": "—",
        "price": "—",
        "financing": "Conventional (30 days)",
        "effective": "Monday, May 4, 2026",
        "closing": "Wednesday, Jun 17, 2026",
        "side": "Buyer Side (Martha Martinez)",
        "status": "🔴 URGENT — Day 3 of 44",
        "next": "Escrow Due — May 7, 2026 (TODAY)",
        "sellers": "CARLOS E TORRES",
        "buyers": "LESTER L WILKS JR",
        "lst_agent": "Evelyn Alcala",
        "lst_lic": "3287335",
        "lst_phone": "(786) 378-1257",
        "lst_email": "evelyn.alcala@compass.com",
        "lst_brokerage": "Compass Florida, LLC",
        "lst_office": "2550 S Bayshore Dr, Ste 106/205/208, Miami, FL 33133 • (305) 697-5402",
        "byr_agent": "Martha Martinez",
        "byr_lic": "647822",
        "byr_phone": "(954) 851-5056",
        "byr_email": "marthamartinez@keyes.com",
        "byr_brokerage": "The Keyes Company",
        "byr_office": "1999 N University Dr, Coral Springs, FL 33071 • (954) 752-0900",
        "title_company": "Pending — to be provided",
        "title_contact": "—",
        "title_phone": "—",
        "title_email": "—",
        "lo_company": "CCM",
        "lo_contact": "Areli Arteaga",
        "lo_phone": "(561) 951-3885",
        "lo_email": "areli.arteaga@ccm.com",
        "concessions": "",
        "milestones": [
            ("Effective Date", "Mon, May 4, 2026", "—"),
            ("Escrow Due", "Thu, May 7, 2026 — $10,000.00", "🔴 DUE TODAY"),
            ("Additional Escrow Due", "Thu, May 21, 2026 — $25,000.00", "⏳ Pending"),
            ("Inspection Due", "Mon, May 11, 2026", "⏳ Pending"),
            ("Loan Application Due", "Sat, May 9, 2026", "⏳ Pending"),
            ("Loan Approval Due", "Wed, Jun 3, 2026", "⏳ Pending"),
            ("HOA Application", "Sat, May 9, 2026", "⏳ Pending"),
            ("HOA Approval", "Fri, Jun 12, 2026 (Not Required)", "⏳ Pending"),
            ("Title Commitment", "Tue, Jun 2, 2026", "⏳ Pending"),
            ("Closing Date", "Wed, Jun 17, 2026", "—"),
        ],
    },
    {
        "short": "19033 NW 23rd Ct",
        "address": "19033 NW 23rd Ct, Pembroke Pines, FL 33029",
        "agent_ref": "Martha (Martha Martinez)",
        "tax_id": "513912130710",
        "price": "$665,000.00",
        "financing": "Conventional (30 days)",
        "effective": "Friday, March 6, 2026",
        "closing": "Thursday, April 16, 2026",
        "side": "Buyer Side (Martha Martinez)",
        "status": "🔴 PAST DUE — Closing date has passed (verify if closed)",
        "next": "Closing Date passed — review & update status manually",
        "sellers": "DAVID DUCHIN & RITA DUCHIN",
        "buyers": "KEITH C. WALTON & TARA A. WALTON",
        "lst_agent": "Natasha Gonell, PA",
        "lst_lic": "3044491",
        "lst_phone": "(954) 643-5770",
        "lst_email": "natashagonell@hotmail.com",
        "lst_brokerage": "eXp Realty, LLC.",
        "lst_office": "10752 Deerwood Park Blvd #100, Jacksonville, FL 32256 • (888) 883-8509",
        "byr_agent": "Martha Martinez",
        "byr_lic": "647822",
        "byr_phone": "(954) 851-5056",
        "byr_email": "marthamartinez@keyes.com",
        "byr_brokerage": "The Keyes Company",
        "byr_office": "1999 N University Dr, Coral Springs, FL 33071 • (954) 752-0900",
        "title_company": "HomePartners Title Services",
        "title_contact": "Pending — to be provided",
        "title_phone": "—",
        "title_email": "—",
        "lo_company": "Edge Home Financing",
        "lo_contact": "Graham Morrison",
        "lo_phone": "M: (954) 806-7187  •  P: (763) 219-8484",
        "lo_email": "graham.m@edgehomefinance.com",
        "concessions": "",
        "milestones": [
            ("Effective Date", "Fri, Mar 6, 2026", "—"),
            ("Escrow Due", "Mon, Mar 9, 2026 — $10,000.00", "—"),
            ("Additional Escrow Due", "Mon, Mar 16, 2026 — $10,000.00", "—"),
            ("Inspection Due", "Mon, Mar 16, 2026", "—"),
            ("Loan Application Due", "Wed, Mar 11, 2026", "—"),
            ("Loan Approval Due", "Mon, Apr 6, 2026 (Conventional)", "—"),
            ("HOA Application", "Wed, Mar 11, 2026", "—"),
            ("HOA Approval", "Fri, Apr 10, 2026 (Not Required)", "—"),
            ("Title Commitment", "Wed, Apr 1, 2026", "—"),
            ("Closing Date", "Thu, Apr 16, 2026", "PAST — verify status"),
        ],
        "notes": "⚠ Closing date (April 16, 2026) has passed. Recommend verifying transaction status and applying manual override (Closed/Cancelled/Active) on the dashboard.",
    },
]


# ============ BUILD WORKBOOK ============
wb = Workbook()
NUM_COLS = 4

# Set up column widths globally
def setup_columns(ws):
    ws.column_dimensions["A"].width = 26
    ws.column_dimensions["B"].width = 30
    ws.column_dimensions["C"].width = 20
    ws.column_dimensions["D"].width = 26
    ws.sheet_view.showGridLines = False


# ===== TAB 1: COVER / INDEX =====
ws_index = wb.active
ws_index.title = "📋 Index"
setup_columns(ws_index)

# Row 1: Title
style_title_bar(ws_index, 1, "MRFL TRANSACTIONS — PORTFOLIO SUMMARY", num_cols=4, size=16)

# Row 2: Subtitle (Gloria's tagline)
ws_index.merge_cells("A2:D2")
sub_cell = ws_index.cell(row=2, column=1,
    value="Gloria Grullon, Transaction Coordinator   •   401.282.8414   •   MRFLTransactions@gmail.com")
sub_cell.font = Font(name="Arial", size=10, italic=True, color="6B7280")
sub_cell.fill = fill(PURPLE_TINT)
sub_cell.alignment = Alignment(horizontal="center", vertical="center")
ws_index.row_dimensions[2].height = 22

# Row 3: Date
ws_index.merge_cells("A3:D3")
date_cell = ws_index.cell(row=3, column=1,
    value=f"As of {datetime.now().strftime('%A, %B %d, %Y')}   •   {len(TRANSACTIONS)} active transactions in this report")
date_cell.font = Font(name="Arial", size=10, color="6B7280")
date_cell.alignment = Alignment(horizontal="center")
ws_index.row_dimensions[3].height = 22

style_spacer(ws_index, 4)

# Row 5: Section header for transactions list
style_section_header(ws_index, 5, "TRANSACTIONS", num_cols=4)

# Row 6: Column headers for the list
headers = ["#  Property", "Agent / Side", "Effective → Closing", "Price / Status"]
for i, h in enumerate(headers, start=1):
    c = ws_index.cell(row=6, column=i, value=h)
    c.font = Font(name="Arial", size=10, bold=True, color="FFFFFF")
    c.fill = fill(INDIGO_DEEP)
    c.alignment = Alignment(horizontal="left", vertical="center", indent=1)
    c.border = border_thin()
ws_index.row_dimensions[6].height = 24

# Rows 7+: One row per transaction
row = 7
for i, t in enumerate(TRANSACTIONS, start=1):
    bg = LIGHT_GRAY if i % 2 == 0 else "FFFFFF"
    
    # Col A: Number + property
    c1 = ws_index.cell(row=row, column=1, value=f"{i}.  {t['short']}")
    c1.font = Font(name="Arial", size=10, bold=True, color=INDIGO_DEEP)
    c1.fill = fill(bg)
    c1.alignment = Alignment(horizontal="left", vertical="center", indent=1)
    c1.border = border_thin()
    
    # Col B: Agent / Side
    c2 = ws_index.cell(row=row, column=2, value=f"{t['agent_ref']}\n{t.get('side', '—')}")
    c2.font = Font(name="Arial", size=9, color=DARK_GRAY)
    c2.fill = fill(bg)
    c2.alignment = Alignment(horizontal="left", vertical="center", indent=1, wrap_text=True)
    c2.border = border_thin()
    
    # Col C: Dates
    c3 = ws_index.cell(row=row, column=3, value=f"{t['effective'].split(',')[1].strip() if ',' in t['effective'] else t['effective']}\n→ {t['closing'].split(',')[1].strip() if ',' in t['closing'] else t['closing']}")
    c3.font = Font(name="Arial", size=9, color=DARK_GRAY)
    c3.fill = fill(bg)
    c3.alignment = Alignment(horizontal="left", vertical="center", indent=1, wrap_text=True)
    c3.border = border_thin()
    
    # Col D: Price + Status (status colored)
    c4 = ws_index.cell(row=row, column=4, value=f"{t['price']}\n{t['status']}")
    c4.font = Font(name="Arial", size=9, bold=True, color=DARK_GRAY)
    c4.fill = fill(bg)
    c4.alignment = Alignment(horizontal="left", vertical="center", indent=1, wrap_text=True)
    c4.border = border_thin()
    
    ws_index.row_dimensions[row].height = 38
    row += 1

# Footer notes
style_spacer(ws_index, row)
row += 1
ws_index.merge_cells(start_row=row, start_column=1, end_row=row, end_column=4)
note = ws_index.cell(row=row, column=1, 
    value="📋 Each transaction has its own tab with full details. Tab numbers match the # column above.")
note.font = Font(name="Arial", size=9, italic=True, color="6B7280")
note.alignment = Alignment(horizontal="center", vertical="center")
ws_index.row_dimensions[row].height = 22

# ===== TABS 2-12: INDIVIDUAL TRANSACTIONS =====
for i, t in enumerate(TRANSACTIONS, start=1):
    # Tab name (limited to 31 chars, no special chars)
    tab_name = f"{i}. {t['short']}"[:31].replace("/", "-").replace("#", "No")
    ws = wb.create_sheet(title=tab_name)
    setup_columns(ws)
    
    r = 1
    
    # Title bar
    style_title_bar(ws, r, "TRANSACTION SUMMARY", num_cols=4, size=14)
    r += 1
    
    # Property address (subtitle)
    ws.merge_cells(start_row=r, start_column=1, end_row=r, end_column=4)
    addr_cell = ws.cell(row=r, column=1, value=t["address"])
    addr_cell.font = Font(name="Arial", size=12, bold=True, color=INDIGO_DEEP)
    addr_cell.fill = fill(PURPLE_TINT)
    addr_cell.alignment = Alignment(horizontal="center", vertical="center")
    ws.row_dimensions[r].height = 28
    r += 1
    
    style_spacer(ws, r)
    r += 1
    
    # ===== PROPERTY DETAILS =====
    style_section_header(ws, r, "📋 PROPERTY DETAILS", num_cols=4)
    r += 1
    style_field_row(ws, r, "Property Address", t["address"]); r += 1
    style_field_row(ws, r, "Property Tax ID", t["tax_id"]); r += 1
    style_field_row(ws, r, "Purchase Price", t["price"]); r += 1
    style_field_row(ws, r, "Financing Type", t["financing"]); r += 1
    style_field_row(ws, r, "Side Represented", t.get("side", "—")); r += 1
    
    style_spacer(ws, r); r += 1
    
    # ===== KEY DATES & STATUS =====
    style_section_header(ws, r, "📅 KEY DATES & STATUS", num_cols=4)
    r += 1
    style_field_row(ws, r, "Effective Date", t["effective"]); r += 1
    style_field_row(ws, r, "Closing Date", t["closing"]); r += 1
    style_field_row(ws, r, "Current Status", t["status"]); r += 1
    style_field_row(ws, r, "Next Deadline", t["next"]); r += 1
    
    # Color the status cell based on urgency
    status_color = get_status_color(t["status"])
    
    style_spacer(ws, r); r += 1
    
    # ===== MILESTONES =====
    style_section_header(ws, r, "🎯 MILESTONES", num_cols=4)
    r += 1
    
    # Milestone table header
    headers_m = ["Milestone", "Deadline", "Status", "Notes"]
    for i_h, h in enumerate(headers_m, start=1):
        c = ws.cell(row=r, column=i_h, value=h)
        c.font = Font(name="Arial", size=9, bold=True, color=WHITE)
        c.fill = fill(PURPLE)
        c.alignment = Alignment(horizontal="left", vertical="center", indent=1)
        c.border = border_thin()
    ws.row_dimensions[r].height = 20
    r += 1
    
    # Milestone rows
    for m_name, m_deadline, m_status in t["milestones"]:
        cells_m = [m_name, m_deadline, m_status, ""]
        for i_c, val in enumerate(cells_m, start=1):
            c = ws.cell(row=r, column=i_c, value=val)
            c.font = Font(name="Arial", size=9, color=DARK_GRAY,
                         bold=("Effective" in m_name or "Closing" in m_name))
            c.fill = fill(WHITE)
            c.alignment = Alignment(horizontal="left", vertical="center", indent=1, wrap_text=True)
            c.border = border_thin()
            if "Effective" in m_name:
                c.font = Font(name="Arial", size=9, bold=True, color="2563EB")
            elif "Closing" in m_name:
                c.font = Font(name="Arial", size=9, bold=True, color="059669")
        ws.row_dimensions[r].height = 18
        r += 1
    
    style_spacer(ws, r); r += 1
    
    # ===== PARTIES =====
    style_section_header(ws, r, "👥 PARTIES", num_cols=4)
    r += 1
    style_field_row(ws, r, "Seller(s)", t["sellers"]); r += 1
    style_field_row(ws, r, "Buyer(s)", t["buyers"]); r += 1
    
    style_spacer(ws, r); r += 1
    
    # ===== LISTING SIDE =====
    style_section_header(ws, r, "🏠 LISTING SIDE", num_cols=4)
    r += 1
    style_field_row(ws, r, "Agent", f"{t['lst_agent']}  (Lic# {t['lst_lic']})"); r += 1
    style_field_row(ws, r, "Phone", t["lst_phone"]); r += 1
    style_field_row(ws, r, "Email", t["lst_email"]); r += 1
    style_field_row(ws, r, "Brokerage", t["lst_brokerage"]); r += 1
    style_field_row(ws, r, "Office", t["lst_office"]); r += 1
    
    if "co_lst_agent" in t:
        style_spacer(ws, r); r += 1
        style_section_header(ws, r, "🏠 CO-LISTING AGENT", num_cols=4, bg=PURPLE)
        r += 1
        style_field_row(ws, r, "Co-Agent", f"{t['co_lst_agent']}  (Lic# {t['co_lst_lic']})"); r += 1
        style_field_row(ws, r, "Phone", t["co_lst_phone"]); r += 1
        style_field_row(ws, r, "Email", t["co_lst_email"]); r += 1
        style_field_row(ws, r, "Brokerage", t["co_lst_brokerage"]); r += 1
        style_field_row(ws, r, "Office", t["co_lst_office"]); r += 1
    
    style_spacer(ws, r); r += 1
    
    # ===== BUYER SIDE =====
    style_section_header(ws, r, "🤝 BUYER SIDE", num_cols=4)
    r += 1
    style_field_row(ws, r, "Agent", f"{t['byr_agent']}  (Lic# {t['byr_lic']})"); r += 1
    style_field_row(ws, r, "Phone", t["byr_phone"]); r += 1
    style_field_row(ws, r, "Email", t["byr_email"]); r += 1
    style_field_row(ws, r, "Brokerage", t["byr_brokerage"]); r += 1
    style_field_row(ws, r, "Office", t["byr_office"]); r += 1
    
    if "co_byr_agent" in t:
        style_spacer(ws, r); r += 1
        style_section_header(ws, r, "🤝 CO-BUYER AGENT", num_cols=4, bg=PURPLE)
        r += 1
        style_field_row(ws, r, "Co-Agent", f"{t['co_byr_agent']}  (Lic# {t['co_byr_lic']})"); r += 1
        style_field_row(ws, r, "Phone", t["co_byr_phone"]); r += 1
        style_field_row(ws, r, "Email", t["co_byr_email"]); r += 1
    
    style_spacer(ws, r); r += 1
    
    # ===== TITLE & ESCROW =====
    style_section_header(ws, r, "📜 TITLE & ESCROW", num_cols=4)
    r += 1
    style_field_row(ws, r, "Company", t["title_company"]); r += 1
    style_field_row(ws, r, "Contact", t["title_contact"]); r += 1
    style_field_row(ws, r, "Phone", t["title_phone"]); r += 1
    style_field_row(ws, r, "Email", t["title_email"]); r += 1
    if "title_address" in t:
        style_field_row(ws, r, "Address", t["title_address"]); r += 1
    
    if "slr_title_company" in t:
        style_spacer(ws, r); r += 1
        style_section_header(ws, r, "📜 SELLER TITLE", num_cols=4, bg=PURPLE)
        r += 1
        style_field_row(ws, r, "Company", t["slr_title_company"]); r += 1
        style_field_row(ws, r, "Contact", t["slr_title_contact"]); r += 1
        style_field_row(ws, r, "Phone", t["slr_title_phone"]); r += 1
        style_field_row(ws, r, "Email", t["slr_title_email"]); r += 1
        if "slr_title_address" in t:
            style_field_row(ws, r, "Address", t["slr_title_address"]); r += 1
    
    if "escrow_company" in t:
        style_spacer(ws, r); r += 1
        style_section_header(ws, r, "💰 ESCROW AGENT", num_cols=4, bg=PURPLE)
        r += 1
        style_field_row(ws, r, "Company", t["escrow_company"]); r += 1
        if "escrow_phone" in t: 
            style_field_row(ws, r, "Phone", t["escrow_phone"]); r += 1
        if "escrow_email" in t: 
            style_field_row(ws, r, "Email", t["escrow_email"]); r += 1
    
    style_spacer(ws, r); r += 1
    
    # ===== LOAN OFFICER =====
    style_section_header(ws, r, "💼 LOAN OFFICER", num_cols=4)
    r += 1
    style_field_row(ws, r, "Company", t["lo_company"]); r += 1
    style_field_row(ws, r, "Contact", t["lo_contact"]); r += 1
    style_field_row(ws, r, "Phone", t["lo_phone"]); r += 1
    style_field_row(ws, r, "Email", t["lo_email"]); r += 1
    
    if "lp_company" in t:
        style_spacer(ws, r); r += 1
        style_section_header(ws, r, "💼 LOAN PROCESSOR", num_cols=4, bg=PURPLE)
        r += 1
        style_field_row(ws, r, "Company", t["lp_company"]); r += 1
        style_field_row(ws, r, "Contact", t["lp_contact"]); r += 1
        style_field_row(ws, r, "Phone", t["lp_phone"]); r += 1
        style_field_row(ws, r, "Email", t["lp_email"]); r += 1
    
    # ===== CONCESSIONS =====
    if t.get("concessions"):
        style_spacer(ws, r); r += 1
        style_section_header(ws, r, "💸 CONCESSIONS / SPECIAL TERMS", num_cols=4)
        r += 1
        ws.merge_cells(start_row=r, start_column=1, end_row=r, end_column=4)
        c = ws.cell(row=r, column=1, value=t["concessions"])
        c.font = Font(name="Arial", size=10, color="7C2D92", bold=True)
        c.fill = fill(LAVENDER)
        c.alignment = Alignment(horizontal="left", vertical="top", indent=1, wrap_text=True)
        c.border = border_thin()
        # Estimate height based on content
        line_count = t["concessions"].count("\n") + 1
        ws.row_dimensions[r].height = max(24, line_count * 18)
        r += 1
    
    # ===== NOTES (if any) =====
    if "notes" in t:
        style_spacer(ws, r); r += 1
        style_section_header(ws, r, "📝 NOTES", num_cols=4)
        r += 1
        ws.merge_cells(start_row=r, start_column=1, end_row=r, end_column=4)
        c = ws.cell(row=r, column=1, value=t["notes"])
        c.font = Font(name="Arial", size=10, italic=True, color=DARK_GRAY)
        c.fill = fill(LIGHT_GRAY)
        c.alignment = Alignment(horizontal="left", vertical="top", indent=1, wrap_text=True)
        c.border = border_thin()
        line_count = t["notes"].count("\n") + 1
        ws.row_dimensions[r].height = max(24, line_count * 18)
        r += 1
    
    # Footer
    style_spacer(ws, r); r += 1
    ws.merge_cells(start_row=r, start_column=1, end_row=r, end_column=4)
    foot = ws.cell(row=r, column=1, 
        value="MRFL Transactions  •  Gloria Grullon, TC  •  401.282.8414  •  MRFLTransactions@gmail.com")
    foot.font = Font(name="Arial", size=9, italic=True, color="6B7280")
    foot.alignment = Alignment(horizontal="center", vertical="center")
    ws.row_dimensions[r].height = 20

# ============ SAVE ============
output_path = "/mnt/user-data/outputs/Transaction_Portfolio_Summary.xlsx"
wb.save(output_path)
print(f"✓ Saved: {output_path}")
print(f"  Total tabs: {len(wb.sheetnames)}")
print(f"  Tab names: {wb.sheetnames}")
