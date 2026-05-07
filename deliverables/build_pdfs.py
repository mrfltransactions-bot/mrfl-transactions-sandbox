#!/usr/bin/env python3
"""Generate one polished PDF per transaction (11 total), branded with MRFL Transactions style."""

import sys
import os
import re
from datetime import datetime

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak,
    KeepTogether
)
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT

# Reuse the transaction data from the portfolio script
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_portfolio import TRANSACTIONS

# ============ BRAND COLORS ============
INDIGO_DEEP = colors.HexColor("#4338CA")
PURPLE = colors.HexColor("#8B5CF6")
INDIGO_NAVY = colors.HexColor("#312E81")
LAVENDER = colors.HexColor("#DDD6FE")
PURPLE_TINT = colors.HexColor("#F5F3FF")
LIGHT_GRAY = colors.HexColor("#F3F4F6")
ROW_ALT = colors.HexColor("#FAFAF7")
DARK_GRAY = colors.HexColor("#374151")
MID_GRAY = colors.HexColor("#6B7280")
LIGHT_BORDER = colors.HexColor("#E5E7EB")
WHITE = colors.white

# Status colors
COLOR_PAST_DUE = colors.HexColor("#991B1B")
COLOR_URGENT = colors.HexColor("#EF4444")
COLOR_WARNING = colors.HexColor("#F59E0B")
COLOR_ON_TRACK = colors.HexColor("#10B981")
COLOR_CLOSED = colors.HexColor("#6B7280")
COLOR_CANCELLED = colors.HexColor("#7F1D1D")
COLOR_ON_HOLD = colors.HexColor("#F97316")


def get_status_color(status_text):
    s = (status_text or "").lower()
    if "past due" in s: return COLOR_PAST_DUE
    if "urgent" in s: return COLOR_URGENT
    if "warning" in s: return COLOR_WARNING
    if "on track" in s or "active" in s: return COLOR_ON_TRACK
    if "cancelled" in s: return COLOR_CANCELLED
    if "closed" in s: return COLOR_CLOSED
    if "on hold" in s: return COLOR_ON_HOLD
    return colors.HexColor("#9CA3AF")


# ============ PARAGRAPH STYLES ============
styles = getSampleStyleSheet()

style_title = ParagraphStyle(
    "title", parent=styles["Normal"],
    fontName="Helvetica-Bold", fontSize=16, textColor=WHITE,
    alignment=TA_CENTER, leading=20,
)

style_subtitle = ParagraphStyle(
    "subtitle", parent=styles["Normal"],
    fontName="Helvetica-Bold", fontSize=14, textColor=INDIGO_DEEP,
    alignment=TA_CENTER, leading=18,
)

style_section = ParagraphStyle(
    "section", parent=styles["Normal"],
    fontName="Helvetica-Bold", fontSize=10, textColor=WHITE,
    leading=13,
)

style_section_alt = ParagraphStyle(
    "section_alt", parent=styles["Normal"],
    fontName="Helvetica-Bold", fontSize=9, textColor=WHITE,
    leading=12,
)

style_label = ParagraphStyle(
    "label", parent=styles["Normal"],
    fontName="Helvetica-Bold", fontSize=8, textColor=DARK_GRAY,
    leading=11,
)

style_value = ParagraphStyle(
    "value", parent=styles["Normal"],
    fontName="Helvetica", fontSize=8, textColor=DARK_GRAY,
    leading=11,
)

style_value_bold = ParagraphStyle(
    "value_bold", parent=styles["Normal"],
    fontName="Helvetica-Bold", fontSize=8, textColor=DARK_GRAY,
    leading=11,
)

style_concession = ParagraphStyle(
    "concession", parent=styles["Normal"],
    fontName="Helvetica-Bold", fontSize=9, textColor=colors.HexColor("#7C2D92"),
    leading=13, leftIndent=4,
)

style_note = ParagraphStyle(
    "note", parent=styles["Normal"],
    fontName="Helvetica-Oblique", fontSize=8, textColor=DARK_GRAY,
    leading=11,
)

style_footer = ParagraphStyle(
    "footer", parent=styles["Normal"],
    fontName="Helvetica-Oblique", fontSize=8, textColor=MID_GRAY,
    alignment=TA_CENTER, leading=10,
)

style_subtitle_small = ParagraphStyle(
    "subtitle_small", parent=styles["Normal"],
    fontName="Helvetica-Oblique", fontSize=9, textColor=MID_GRAY,
    alignment=TA_CENTER, leading=12,
)


def make_title_block(t):
    """Build the title bar and subtitle for the top of each PDF."""
    elements = []
    
    # Indigo title bar
    title_text = Paragraph("📋 TRANSACTION SUMMARY", style_title)
    title_table = Table([[title_text]], colWidths=[7.0 * inch], rowHeights=[0.5 * inch])
    title_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), INDIGO_DEEP),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
    ]))
    elements.append(title_table)
    
    # Property address subtitle
    addr_text = Paragraph(t["address"], style_subtitle)
    addr_table = Table([[addr_text]], colWidths=[7.0 * inch], rowHeights=[0.4 * inch])
    addr_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), PURPLE_TINT),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
    ]))
    elements.append(addr_table)
    
    # Brand subtitle
    brand_text = Paragraph(
        "Prepared by Gloria Grullon, Transaction Coordinator   •   MRFL Transactions   •   "
        f"Issued {datetime.now().strftime('%B %d, %Y')}",
        style_subtitle_small
    )
    brand_table = Table([[brand_text]], colWidths=[7.0 * inch], rowHeights=[0.3 * inch])
    brand_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), WHITE),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    elements.append(brand_table)
    elements.append(Spacer(1, 0.1 * inch))
    
    return elements


def make_section(title_text, rows, status_color=None):
    """
    Build a section table with:
      Row 0: section header (indigo bg)
      Rows 1+: label/value pairs
    `rows` is a list of (label, value) tuples.
    """
    if not rows:
        return None
    
    # Build the table data
    data = [[Paragraph(title_text, style_section), ""]]
    for label, value in rows:
        # Make sure value is a string and handle None
        v = value if value not in (None, "") else "—"
        data.append([
            Paragraph(label, style_label),
            Paragraph(str(v).replace("\n", "<br/>"), style_value)
        ])
    
    # Column widths: 1.6" for label, 5.4" for value
    col_widths = [1.6 * inch, 5.4 * inch]
    table = Table(data, colWidths=col_widths)
    
    # Build style
    style = [
        # Header row
        ("SPAN", (0, 0), (1, 0)),
        ("BACKGROUND", (0, 0), (-1, 0), INDIGO_NAVY),
        ("LEFTPADDING", (0, 0), (-1, 0), 8),
        ("TOPPADDING", (0, 0), (-1, 0), 5),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 5),
        # Body rows
        ("BACKGROUND", (0, 1), (0, -1), LIGHT_GRAY),
        ("BACKGROUND", (1, 1), (1, -1), WHITE),
        ("VALIGN", (0, 1), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 1), (-1, -1), 6),
        ("RIGHTPADDING", (0, 1), (-1, -1), 6),
        ("TOPPADDING", (0, 1), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 1), (-1, -1), 4),
        # Borders for body rows
        ("LINEBELOW", (0, 1), (-1, -2), 0.25, LIGHT_BORDER),
        ("BOX", (0, 1), (-1, -1), 0.5, LIGHT_BORDER),
    ]
    
    # Optionally color a Status row
    if status_color:
        for i, (label, _) in enumerate(rows, start=1):
            if "Status" in label or "status" in label:
                style.append(("BACKGROUND", (1, i), (1, i), status_color))
                style.append(("TEXTCOLOR", (1, i), (1, i), WHITE))
                # Override the paragraph color by replacing the cell content
                data[i][1] = Paragraph(
                    f'<font color="white"><b>{rows[i-1][1]}</b></font>',
                    style_value
                )
                break
    
    table.setStyle(TableStyle(style))
    return table


def make_milestone_table(milestones):
    """Build the milestones table."""
    # Header row
    header_row = [
        Paragraph("🎯 MILESTONES", style_section), "", "", ""
    ]
    
    # Column headers
    col_header = [
        Paragraph('<font color="white"><b>Milestone</b></font>', style_value),
        Paragraph('<font color="white"><b>Deadline</b></font>', style_value),
        Paragraph('<font color="white"><b>Status</b></font>', style_value),
        Paragraph('<font color="white"><b>Notes</b></font>', style_value),
    ]
    
    data = [header_row, col_header]
    
    for m_name, m_deadline, m_status in milestones:
        # Color-code Effective and Closing
        if "Effective" in m_name:
            name_para = Paragraph(f'<b><font color="#2563EB">{m_name}</font></b>', style_value)
            deadline_para = Paragraph(f'<font color="#2563EB">{m_deadline}</font>', style_value)
        elif "Closing" in m_name:
            name_para = Paragraph(f'<b><font color="#059669">{m_name}</font></b>', style_value)
            deadline_para = Paragraph(f'<font color="#059669">{m_deadline}</font>', style_value)
        else:
            name_para = Paragraph(m_name, style_value)
            deadline_para = Paragraph(m_deadline, style_value)
        
        status_para = Paragraph(m_status, style_value)
        data.append([name_para, deadline_para, status_para, ""])
    
    col_widths = [1.7 * inch, 2.4 * inch, 1.4 * inch, 1.5 * inch]
    table = Table(data, colWidths=col_widths)
    
    style = [
        # Section header (row 0)
        ("SPAN", (0, 0), (3, 0)),
        ("BACKGROUND", (0, 0), (-1, 0), INDIGO_NAVY),
        ("LEFTPADDING", (0, 0), (-1, 0), 8),
        ("TOPPADDING", (0, 0), (-1, 0), 5),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 5),
        # Column headers (row 1)
        ("BACKGROUND", (0, 1), (-1, 1), PURPLE),
        ("LEFTPADDING", (0, 1), (-1, 1), 6),
        ("TOPPADDING", (0, 1), (-1, 1), 4),
        ("BOTTOMPADDING", (0, 1), (-1, 1), 4),
        # Data rows
        ("BACKGROUND", (0, 2), (-1, -1), WHITE),
        ("VALIGN", (0, 2), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 2), (-1, -1), 6),
        ("RIGHTPADDING", (0, 2), (-1, -1), 6),
        ("TOPPADDING", (0, 2), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 2), (-1, -1), 3),
        # Borders
        ("LINEBELOW", (0, 2), (-1, -2), 0.25, LIGHT_BORDER),
        ("BOX", (0, 1), (-1, -1), 0.5, LIGHT_BORDER),
    ]
    
    # Alternate row backgrounds
    for i in range(2, len(data)):
        if i % 2 == 0:
            style.append(("BACKGROUND", (0, i), (-1, i), ROW_ALT))
    
    table.setStyle(TableStyle(style))
    return table


def make_concession_box(concession_text):
    """Build the concessions section as a highlighted box."""
    if not concession_text:
        return None
    
    header = Paragraph("💸 CONCESSIONS / SPECIAL TERMS", style_section)
    body = Paragraph(concession_text.replace("\n", "<br/>"), style_concession)
    
    data = [[header], [body]]
    table = Table(data, colWidths=[7.0 * inch])
    table.setStyle(TableStyle([
        # Header
        ("BACKGROUND", (0, 0), (-1, 0), INDIGO_NAVY),
        ("LEFTPADDING", (0, 0), (-1, 0), 8),
        ("TOPPADDING", (0, 0), (-1, 0), 5),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 5),
        # Body
        ("BACKGROUND", (0, 1), (-1, 1), LAVENDER),
        ("LEFTPADDING", (0, 1), (-1, 1), 10),
        ("RIGHTPADDING", (0, 1), (-1, 1), 10),
        ("TOPPADDING", (0, 1), (-1, 1), 8),
        ("BOTTOMPADDING", (0, 1), (-1, 1), 8),
        ("BOX", (0, 0), (-1, -1), 0.5, LIGHT_BORDER),
    ]))
    return table


def make_note_box(note_text):
    """Build a notes section."""
    if not note_text:
        return None
    
    header = Paragraph("📝 NOTES", style_section)
    body = Paragraph(note_text.replace("\n", "<br/>"), style_note)
    
    data = [[header], [body]]
    table = Table(data, colWidths=[7.0 * inch])
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), INDIGO_NAVY),
        ("LEFTPADDING", (0, 0), (-1, 0), 8),
        ("TOPPADDING", (0, 0), (-1, 0), 5),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 5),
        ("BACKGROUND", (0, 1), (-1, 1), LIGHT_GRAY),
        ("LEFTPADDING", (0, 1), (-1, 1), 10),
        ("RIGHTPADDING", (0, 1), (-1, 1), 10),
        ("TOPPADDING", (0, 1), (-1, 1), 8),
        ("BOTTOMPADDING", (0, 1), (-1, 1), 8),
        ("BOX", (0, 0), (-1, -1), 0.5, LIGHT_BORDER),
    ]))
    return table


def make_status_badge(status_text):
    """Build a colored status badge below the title."""
    color = get_status_color(status_text)
    badge = Paragraph(
        f'<font color="white"><b>STATUS: {status_text}</b></font>',
        style_subtitle
    )
    table = Table([[badge]], colWidths=[7.0 * inch], rowHeights=[0.35 * inch])
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), color),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    return table


def make_footer():
    """Footer with Gloria's contact info."""
    return Paragraph(
        "MRFL Transactions   •   Gloria Grullon, Transaction Coordinator   •   "
        "401.282.8414   •   MRFLTransactions@gmail.com",
        style_footer
    )


def safe_filename(s):
    """Convert a property name to a safe filename."""
    s = re.sub(r'[^\w\s-]', '', s)
    s = re.sub(r'\s+', '_', s.strip())
    return s


def build_pdf_for_transaction(t, output_path):
    """Build one PDF for one transaction."""
    doc = SimpleDocTemplate(
        output_path, pagesize=letter,
        leftMargin=0.6 * inch, rightMargin=0.6 * inch,
        topMargin=0.5 * inch, bottomMargin=0.5 * inch,
        title=f"Transaction Summary — {t['address']}",
        author="Gloria Grullon, MRFL Transactions",
    )
    
    story = []
    
    # Title block
    story.extend(make_title_block(t))
    
    # Status badge
    story.append(make_status_badge(t["status"]))
    story.append(Spacer(1, 0.12 * inch))
    
    # Property Details
    prop_rows = [
        ("Property Address", t["address"]),
        ("Property Tax ID", t["tax_id"]),
        ("Purchase Price", t["price"]),
        ("Financing Type", t["financing"]),
        ("Side Represented", t.get("side", "—")),
    ]
    section = make_section("📋 PROPERTY DETAILS", prop_rows)
    if section:
        story.append(section)
        story.append(Spacer(1, 0.1 * inch))
    
    # Key Dates
    dates_rows = [
        ("Effective Date", t["effective"]),
        ("Closing Date", t["closing"]),
        ("Next Deadline", t["next"]),
    ]
    section = make_section("📅 KEY DATES", dates_rows)
    if section:
        story.append(section)
        story.append(Spacer(1, 0.1 * inch))
    
    # Parties
    party_rows = [
        ("Seller(s)", t["sellers"]),
        ("Buyer(s)", t["buyers"]),
    ]
    section = make_section("👥 PARTIES", party_rows)
    if section:
        story.append(section)
        story.append(Spacer(1, 0.1 * inch))
    
    # Listing Side
    lst_rows = [
        ("Agent", f"{t['lst_agent']}  (Lic# {t['lst_lic']})"),
        ("Phone", t["lst_phone"]),
        ("Email", t["lst_email"]),
        ("Brokerage", t["lst_brokerage"]),
        ("Office", t["lst_office"]),
    ]
    section = make_section("🏠 LISTING SIDE", lst_rows)
    if section:
        story.append(section)
        story.append(Spacer(1, 0.1 * inch))
    
    # Co-Listing (if any)
    if "co_lst_agent" in t:
        co_rows = [
            ("Co-Agent", f"{t['co_lst_agent']}  (Lic# {t['co_lst_lic']})"),
            ("Phone", t["co_lst_phone"]),
            ("Email", t["co_lst_email"]),
            ("Brokerage", t["co_lst_brokerage"]),
            ("Office", t["co_lst_office"]),
        ]
        section = make_section("🏠 CO-LISTING AGENT", co_rows)
        if section:
            story.append(section)
            story.append(Spacer(1, 0.1 * inch))
    
    # Buyer Side
    byr_rows = [
        ("Agent", f"{t['byr_agent']}  (Lic# {t['byr_lic']})"),
        ("Phone", t["byr_phone"]),
        ("Email", t["byr_email"]),
        ("Brokerage", t["byr_brokerage"]),
        ("Office", t["byr_office"]),
    ]
    section = make_section("🤝 BUYER SIDE", byr_rows)
    if section:
        story.append(section)
        story.append(Spacer(1, 0.1 * inch))
    
    # Co-Buyer (if any)
    if "co_byr_agent" in t:
        co_rows = [
            ("Co-Agent", f"{t['co_byr_agent']}  (Lic# {t['co_byr_lic']})"),
            ("Phone", t["co_byr_phone"]),
            ("Email", t["co_byr_email"]),
        ]
        section = make_section("🤝 CO-BUYER AGENT", co_rows)
        if section:
            story.append(section)
            story.append(Spacer(1, 0.1 * inch))
    
    # Title & Escrow
    title_rows = [
        ("Company", t["title_company"]),
        ("Contact", t["title_contact"]),
        ("Phone", t["title_phone"]),
        ("Email", t["title_email"]),
    ]
    if "title_address" in t:
        title_rows.append(("Address", t["title_address"]))
    section = make_section("📜 TITLE & ESCROW", title_rows)
    if section:
        story.append(section)
        story.append(Spacer(1, 0.1 * inch))
    
    # Seller Title (if separate)
    if "slr_title_company" in t:
        slr_rows = [
            ("Company", t["slr_title_company"]),
            ("Contact", t["slr_title_contact"]),
            ("Phone", t["slr_title_phone"]),
            ("Email", t["slr_title_email"]),
        ]
        if "slr_title_address" in t:
            slr_rows.append(("Address", t["slr_title_address"]))
        section = make_section("📜 SELLER TITLE", slr_rows)
        if section:
            story.append(section)
            story.append(Spacer(1, 0.1 * inch))
    
    # Escrow Agent (if separate)
    if "escrow_company" in t:
        esc_rows = [("Company", t["escrow_company"])]
        if "escrow_phone" in t:
            esc_rows.append(("Phone", t["escrow_phone"]))
        if "escrow_email" in t:
            esc_rows.append(("Email", t["escrow_email"]))
        section = make_section("💰 ESCROW AGENT", esc_rows)
        if section:
            story.append(section)
            story.append(Spacer(1, 0.1 * inch))
    
    # Loan Officer
    lo_rows = [
        ("Company", t["lo_company"]),
        ("Contact", t["lo_contact"]),
        ("Phone", t["lo_phone"]),
        ("Email", t["lo_email"]),
    ]
    section = make_section("💼 LOAN OFFICER", lo_rows)
    if section:
        story.append(section)
        story.append(Spacer(1, 0.1 * inch))
    
    # Loan Processor (if any)
    if "lp_company" in t:
        lp_rows = [
            ("Company", t["lp_company"]),
            ("Contact", t["lp_contact"]),
            ("Phone", t["lp_phone"]),
            ("Email", t["lp_email"]),
        ]
        section = make_section("💼 LOAN PROCESSOR", lp_rows)
        if section:
            story.append(section)
            story.append(Spacer(1, 0.1 * inch))
    
    # Concessions (if any)
    if t.get("concessions"):
        concession_box = make_concession_box(t["concessions"])
        if concession_box:
            story.append(concession_box)
            story.append(Spacer(1, 0.1 * inch))
    
    # Milestones table
    milestone_table = make_milestone_table(t["milestones"])
    story.append(milestone_table)
    story.append(Spacer(1, 0.1 * inch))
    
    # Notes (if any)
    if "notes" in t:
        note_box = make_note_box(t["notes"])
        if note_box:
            story.append(note_box)
            story.append(Spacer(1, 0.12 * inch))
    
    # Footer
    story.append(Spacer(1, 0.15 * inch))
    story.append(make_footer())
    
    doc.build(story)


# ============ BUILD ALL PDFs ============
output_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "output")
os.makedirs(output_dir, exist_ok=True)

print(f"Building {len(TRANSACTIONS)} transaction PDFs...\n")

generated_files = []
for i, t in enumerate(TRANSACTIONS, start=1):
    safe_name = safe_filename(t["short"])
    output_path = f"{output_dir}/Transaction_Summary_{i:02d}_{safe_name}.pdf"
    
    try:
        build_pdf_for_transaction(t, output_path)
        size_kb = os.path.getsize(output_path) / 1024
        print(f"  [{i:2d}] ✓ {os.path.basename(output_path)}  ({size_kb:.1f} KB)")
        generated_files.append(output_path)
    except Exception as e:
        print(f"  [{i:2d}] ✗ FAILED for {t['address']}: {e}")
        import traceback
        traceback.print_exc()

print(f"\n✓ Generated {len(generated_files)} PDFs in {output_dir}/")
