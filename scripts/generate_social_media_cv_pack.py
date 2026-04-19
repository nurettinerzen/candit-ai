#!/usr/bin/env python3

from __future__ import annotations

import csv
import json
import math
import re
import zipfile
from copy import deepcopy
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


ROOT = Path(__file__).resolve().parents[1]
ARTIFACTS_DIR = ROOT / "artifacts"
FONT_REGULAR = "/Library/Fonts/Arial Unicode.ttf"
FONT_BOLD = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"

JOB_BRIEF = {
    "title": "Sosyal Medya Uzmani",
    "company_type": "perakende, lifestyle ve dijital kanallari aktif kullanan bir marka",
    "location": "Istanbul / Cekmekoy",
    "work_model": "hibrit",
    "core_expectations": [
        "Instagram, TikTok ve benzeri platformlarda icerik planlama ve gunluk hesap yonetimi",
        "icerik takvimi, post kurgusu, caption yazimi ve topluluk yonetimi",
        "influencer, UGC veya cekim koordinasyonuna yakin calisabilme",
        "performans takibi, aylik raporlama ve temel analitik okuryazarligi",
        "marka tonu, yorum-yanit sureci ve ekiplerle koordinasyon"
    ],
}

FIRST_NAMES = [
    "Ece", "Burak", "Selin", "Mert", "Asli",
    "Zeynep", "Can", "Naz", "Derya", "Umut",
    "Rabia", "Kaan", "Melis", "Bora", "Ayca",
    "Deniz", "Sude", "Ali", "Ceren", "Onur",
    "Elif", "Tuna", "Sinem", "Baris", "Beste",
    "Mina", "Arda", "Ipek", "Kerem", "Yagmur",
    "Nehir", "Emre", "Yaren", "Batuhan", "Esra",
    "Damla", "Eren", "Nisa", "Tolga", "Pelin",
    "Doga", "Merve", "Ozan", "Gizem", "Selim",
    "Aylin", "Berke", "Cagla", "Furkan", "Eylul",
]

LAST_NAMES = [
    "Yildirim", "Demirel", "Ozturk", "Sahin", "Tokdemir",
    "Arslan", "Kara", "Aydin", "Celik", "Kilic",
    "Coskun", "Efeoglu", "Kurt", "Tas", "Polat",
    "Acar", "Erden", "Yaman", "Kose", "Akin",
    "Gur", "Ersoy", "Cetin", "Aksu", "Sezer",
    "Ozgur", "Bozkurt", "Pekel", "Karatas", "Gul",
    "Ates", "Toprak", "Gunes", "Bulut", "Aydogan",
    "Kaya", "Sari", "Unal", "Ozdemir", "Kandemir",
    "Cinar", "Dogan", "Akinci", "Kaplan", "Yuce",
    "Alkan", "Yoruk", "Arikan", "Yurt", "Bicer",
]


@dataclass(frozen=True)
class LocationVariant:
    key: str
    label: str
    location: str
    location_signal: int
    overall_modifier: int
    commute_note: str


LOCATION_VARIANTS = [
    LocationVariant(
        key="cekmekoy_local",
        label="Cekmekoy",
        location="Istanbul / Cekmekoy",
        location_signal=95,
        overall_modifier=0,
        commute_note="Ofis lokasyonuna yakin. Hibrit duzen icin operasyonel risk dusuk."
    ),
    LocationVariant(
        key="umraniye_near",
        label="Umraniye",
        location="Istanbul / Umraniye",
        location_signal=90,
        overall_modifier=0,
        commute_note="Ayni bolgede sayilabilir. Ulasim genelde yonetilebilir."
    ),
    LocationVariant(
        key="halkali_far",
        label="Halkali",
        location="Istanbul / Halkali",
        location_signal=72,
        overall_modifier=-1,
        commute_note="Ayni sehirde ama uzak ilce. Warning olur; tek basina skoru ezmemeli."
    ),
    LocationVariant(
        key="bursa_city",
        label="Bursa",
        location="Bursa / Nilufer",
        location_signal=55,
        overall_modifier=-3,
        commute_note="Farkli sehir. Operasyonel teyit gerekir ama role-fit'in yerine gecmemeli."
    ),
    LocationVariant(
        key="berlin_foreign",
        label="Berlin",
        location="Berlin / Germany",
        location_signal=45,
        overall_modifier=-4,
        commute_note="Yurt disi lokasyon. Hala warning niteliginde; tek basina kuvvetli adayi ezmemeli."
    ),
]


SERIES = [
    {
        "series_key": "strong_fashion_social",
        "archetype": "Guculu direct-fit",
        "headline": "Senior Social Media Specialist",
        "base_scores": {
            "role_experience": 92,
            "platform_tools": 90,
            "content_execution": 89,
            "analytics_reporting": 78,
            "community_communication": 88,
        },
        "summary": (
            "Moda ve lifestyle markalarinda 7 yillik sosyal medya deneyimim var. "
            "Instagram ve TikTok icerik planlamasi, aylik takvim olusturma, UGC ve influencer koordinasyonu, "
            "yorum-yanit akisi ve temel performans raporlamasi tarafinda aktif rol aliyorum."
        ),
        "experience": [
            {
                "period": "2023 - 2026",
                "title": "Senior Social Media Specialist",
                "company": "Luna Moda",
                "bullets": [
                    "Instagram ve TikTok icin aylik icerik takvimi olusturdum, haftalik cekim brieflerini hazirladim.",
                    "UGC ve influencer is birliklerinde ajansla koordinasyonu yuruttum; lansman donemlerinde icerik akisini yonettim.",
                    "Aylik erisim, etkileşim ve topluluk performans raporlarini marka yonetimine sundum.",
                ],
            },
            {
                "period": "2020 - 2023",
                "title": "Social Media Executive",
                "company": "Renk Collective",
                "bullets": [
                    "Guzellik ve perakende hesaplarinda gunde 2-3 post akisi, story plani ve yorum yonetimi yaptim.",
                    "Meta Business Suite, Later ve CapCut ile gorsel/video akislarini takip ettim.",
                ],
            },
        ],
        "skills": [
            "Instagram", "TikTok", "Meta Business Suite", "Later", "CapCut", "Canva",
            "Icerik Takvimi", "UGC", "Influencer Koordinasyonu", "Topluluk Yonetimi"
        ],
        "education": "Marmara Universitesi - Halkla Iliskiler ve Tanitim",
        "certifications": ["Meta Certified Digital Marketing Associate", "Google Analytics 4 Basics"],
        "languages": ["Turkce (ana dil)", "Ingilizce (B2)"],
        "key_strengths": [
            "Gunluk sosyal medya operasyonunu uca kadar yurutebilme",
            "Moda/lifestyle kategorisinde icerik ve topluluk tecrubesi",
            "Influencer ve UGC tarafinda uygulama deneyimi",
        ],
        "key_risks": [
            "Buyuk olcekli paid social butcesi tecrubesi sinirli olabilir",
            "Kriz iletisim ornekleri recruiter gorusmesinde acilmali",
        ],
    },
    {
        "series_key": "strong_agency_multibrand",
        "archetype": "Guculu direct-fit",
        "headline": "Agency Social Media Manager",
        "base_scores": {
            "role_experience": 89,
            "platform_tools": 86,
            "content_execution": 84,
            "analytics_reporting": 80,
            "community_communication": 82,
        },
        "summary": (
            "Ajans tarafinda 6 yildir farkli markalarin sosyal medya hesaplarini yonetiyorum. "
            "Icerik takvimi, musteri sunumlari, kampanya donemi icerik akisi, yorum moderasyonu ve raporlama tarafinda gucluyum."
        ),
        "experience": [
            {
                "period": "2022 - 2026",
                "title": "Social Media Manager",
                "company": "North Frame Agency",
                "bullets": [
                    "Perakende, guzellik ve FMCG markalari icin aylik icerik takvimi ve shoot briefleri olusturdum.",
                    "Musteri sunumlarinda aylik performans, icerik ogrenimleri ve gelecek ay aksiyon planlarini paylastim.",
                    "Topluluk yonetimi, kreatif ekip ve hesap yonetimi arasinda gunluk koordinasyonu sagladim.",
                ],
            },
            {
                "period": "2019 - 2022",
                "title": "Social Media Specialist",
                "company": "Vivid Room",
                "bullets": [
                    "Instagram, Facebook ve TikTok hesaplarinda post, story, reels ve kampanya akisini yonettim.",
                    "Yorum ve DM yanit sirasini belirleyip marka tonu rehberine uygun moderasyon yaptim.",
                ],
            },
        ],
        "skills": [
            "Instagram", "TikTok", "Facebook", "Meta Business Suite", "Notion",
            "Canva", "Brief Yazimi", "Topluluk Yonetimi", "Aylik Raporlama", "Musteri Iletisimi"
        ],
        "education": "Istanbul Bilgi Universitesi - Medya ve Iletisim",
        "certifications": ["Meta Social Media Professional Certificate"],
        "languages": ["Turkce (ana dil)", "Ingilizce (B2)"],
        "key_strengths": [
            "Farkli marka tonlarina hizli adapte olabilme",
            "Ajans temposunda icerik ve moderasyon yonetimi",
            "Sunum ve raporlama disiplini",
        ],
        "key_risks": [
            "Tek bir markanin ic ekip dinamiklerine adaptasyon sureci gorusmede sorulmali",
            "Video cekim tarafinda hands-on seviyesi teyit edilmeli",
        ],
    },
    {
        "series_key": "strong_video_community",
        "archetype": "Guculu direct-fit",
        "headline": "Social Media & Video Content Lead",
        "base_scores": {
            "role_experience": 87,
            "platform_tools": 88,
            "content_execution": 91,
            "analytics_reporting": 74,
            "community_communication": 86,
        },
        "summary": (
            "Short-form video ve topluluk odakli sosyal medya rolleri ustlendim. "
            "TikTok, Reels, trend takibi, cekim akisi, yorum moderasyonu ve icerik performans ogrenileri cikarma tarafinda gucluyum."
        ),
        "experience": [
            {
                "period": "2022 - 2026",
                "title": "Social Media & Video Content Lead",
                "company": "Mellow Skin",
                "bullets": [
                    "TikTok ve Instagram Reels formatlari icin haftalik cekim listesi ve trend takibi yaptim.",
                    "Topluluk yorumlarini briefleyip sik sorulan sorular icin yanit kutuphanesi olusturdum.",
                    "Izlenme, kaydetme ve yorum oranlarina gore icerik formatlarinda optimizasyon yaptim.",
                ],
            },
            {
                "period": "2019 - 2022",
                "title": "Social Media Content Specialist",
                "company": "Glow House",
                "bullets": [
                    "Kisa video kurgulari icin CapCut ve Premiere Pro destekli akis yonettim.",
                    "Influencer barter ve UGC toplama sureclerinde marketing ekibiyle birlikte calistim.",
                ],
            },
        ],
        "skills": [
            "TikTok", "Instagram Reels", "CapCut", "Premiere Pro",
            "Trend Takibi", "Topluluk Yonetimi", "UGC", "Kisa Video Kurgusu", "Icerik Brifi"
        ],
        "education": "Kadir Has Universitesi - Yeni Medya",
        "certifications": ["TikTok Creative Essentials"],
        "languages": ["Turkce (ana dil)", "Ingilizce (B1)"],
        "key_strengths": [
            "Short-form video odakli icerik uretim refleksi",
            "Topluluk geri bildiriminden icerik ogrenisi cikarabilme",
            "Trend ve format hizina uyum",
        ],
        "key_risks": [
            "Kurumsal/LinkedIn tonu gerektiren markalarda referans istanebilir",
            "Detayli dashboard ve Excel raporlama seviyesi teyit edilmeli",
        ],
    },
    {
        "series_key": "strong_b2b_linkedin",
        "archetype": "Guculu direct-fit",
        "headline": "B2B Social Media Specialist",
        "base_scores": {
            "role_experience": 84,
            "platform_tools": 78,
            "content_execution": 82,
            "analytics_reporting": 81,
            "community_communication": 79,
        },
        "summary": (
            "B2B teknoloji ve hizmet markalarinda LinkedIn, Instagram ve employer brand odakli sosyal medya operasyonlarini yonettim. "
            "Uzman iceriklerinin sosyal dile uyarlanmasi, aylik plan, webinar/promosyon duyurulari ve performans takibinde deneyimliyim."
        ),
        "experience": [
            {
                "period": "2021 - 2026",
                "title": "B2B Social Media Specialist",
                "company": "Cloudwise",
                "bullets": [
                    "LinkedIn ve Instagram icerik planlarini urun, satis ve tasarim ekipleriyle koordine ettim.",
                    "Webinar, etkinlik ve duyuru iceriklerini sosyal takvimle hizaladim.",
                    "Aylik erisim, tiklanma ve lead destekli sosyal raporlari hazirladim.",
                ],
            },
            {
                "period": "2018 - 2021",
                "title": "Content & Social Media Executive",
                "company": "Netbridge B2B",
                "bullets": [
                    "Yonetici hesaplari icin thought leadership icerikleri ve duyuru postlari hazirladim.",
                    "Topluluk ve yorum yonetimini marka tonu rehberine gore yurutttum.",
                ],
            },
        ],
        "skills": [
            "LinkedIn", "Instagram", "Meta Business Suite", "Canva",
            "B2B Icerik Planlama", "Aylik Raporlama", "Webinar Promosyonu", "Employer Brand"
        ],
        "education": "Galatasaray Universitesi - Iletisim",
        "certifications": ["LinkedIn Marketing Labs - Content and Creative Design"],
        "languages": ["Turkce (ana dil)", "Ingilizce (C1)"],
        "key_strengths": [
            "Kurumsal icerigi sosyal medya diline indirebilme",
            "Ekiplerle koordineli takvim yonetimi",
            "Raporlama ve yonetici sunumu disiplini",
        ],
        "key_risks": [
            "TikTok veya creator-led consumer icerik deneyimi sinirli olabilir",
            "Hizli perakende kampanya temposu gorusmede sorulmali",
        ],
    },
    {
        "series_key": "strong_manager_hands_on",
        "archetype": "Sinir guclu / senior",
        "headline": "Social Media Manager",
        "base_scores": {
            "role_experience": 82,
            "platform_tools": 78,
            "content_execution": 80,
            "analytics_reporting": 76,
            "community_communication": 84,
        },
        "summary": (
            "Son donemde title olarak manager seviyesinde calistim ama icerik akisi, yorum moderasyonu, kreatif brif ve haftalik rapor tarafinda hala operasyonun icindeyim. "
            "Hem ekip koordinasyonu hem bireysel katkida devam eden bir profilim var."
        ),
        "experience": [
            {
                "period": "2022 - 2026",
                "title": "Social Media Manager",
                "company": "Nova Living",
                "bullets": [
                    "Iki kisilik sosyal medya ekibinin is dagilimini ve haftalik takvimini yonettim.",
                    "Kampanya haftalarinda onay, caption ve yorum moderasyonu tarafinda dogrudan operasyon yaptim.",
                    "Aylik performans ozeti ve icerik derslerini marketing yoneticisine raporladim.",
                ],
            },
            {
                "period": "2018 - 2022",
                "title": "Senior Social Media Specialist",
                "company": "Happy Home",
                "bullets": [
                    "Instagram ve Facebook hesaplarinin gunluk akisindan ve topluluk yonetiminden sorumluydum.",
                    "Kucuk butceli boost kampanyalari ve influencer operasyonlarini koordine ettim.",
                ],
            },
        ],
        "skills": [
            "Instagram", "Facebook", "TikTok temel", "Canva",
            "Topluluk Yonetimi", "Kreatif Brif", "Aylik Raporlama", "Takim Koordinasyonu"
        ],
        "education": "Istanbul Universitesi - Isletme",
        "certifications": ["Meta Certified Digital Marketing Associate"],
        "languages": ["Turkce (ana dil)", "Ingilizce (B2)"],
        "key_strengths": [
            "Yonetici title'ina ragmen operasyonu birakmamis olmak",
            "Takim ve kreatif koordinasyonu",
            "Marka tonu ve yorum yonetimi deneyimi",
        ],
        "key_risks": [
            "Cok hands-on ve hizli ureten bir ortam icin operasyonel temposu teyit edilmeli",
            "TikTok ve yeni formatlarda guncellik seviyesi gorusmede acilmali",
        ],
    },
    {
        "series_key": "medium_content_brand",
        "archetype": "Adjacent / orta",
        "headline": "Content Marketing Specialist",
        "base_scores": {
            "role_experience": 60,
            "platform_tools": 55,
            "content_execution": 73,
            "analytics_reporting": 52,
            "community_communication": 66,
        },
        "summary": (
            "Icerik planlama, copywriting ve marka hikayesi tarafinda gucluyum. "
            "Sosyal medya ile yakin calistim ama gunluk sosyal medya operasyonunu tek basima sahiplenen bir rolde daha az deneyimim var."
        ),
        "experience": [
            {
                "period": "2022 - 2026",
                "title": "Content Marketing Specialist",
                "company": "Story Deck",
                "bullets": [
                    "Blog, newsletter ve kampanya metinlerini hazirladim; sosyal medya ekiplerine caption ve mesajlasma destegi verdim.",
                    "Lansman donemlerinde icerik takvimi toplantilarina katildim ve kreatif brief urettim.",
                ],
            },
            {
                "period": "2019 - 2022",
                "title": "Copywriter",
                "company": "Blue Pepper",
                "bullets": [
                    "Marka tonu rehberleri ve urun icerikleri yazdim.",
                    "Sosyal medya post metinleri hazirladim ancak hesap yonetimi ana sorumlulugum degildi.",
                ],
            },
        ],
        "skills": [
            "Copywriting", "Icerik Planlama", "Brief Yazimi", "Canva",
            "Instagram temel", "Newsletter", "Marka Dili"
        ],
        "education": "Istanbul Bilgi Universitesi - Iletisim",
        "certifications": ["HubSpot Content Marketing"],
        "languages": ["Turkce (ana dil)", "Ingilizce (B2)"],
        "key_strengths": [
            "Icerik dili ve marka tonuna hakimiyet",
            "Caption, brief ve hikaye anlatimi becerisi",
        ],
        "key_risks": [
            "Gunluk hesap yonetimi ve yorum moderasyonu tecrubesi sinirli",
            "TikTok/Reels gibi hizli formatlarda uygulama ornegi istenmeli",
        ],
    },
    {
        "series_key": "medium_pr_influencer",
        "archetype": "Adjacent / orta",
        "headline": "PR & Influencer Executive",
        "base_scores": {
            "role_experience": 57,
            "platform_tools": 58,
            "content_execution": 64,
            "analytics_reporting": 48,
            "community_communication": 74,
        },
        "summary": (
            "PR, influencer iliskileri ve etkinlik duyurulari tarafinda 5 yillik deneyimim var. "
            "Sosyal medya ekipleriyle yakin calistim ama analitik ve gunluk dashboard takibi tarafinda daha orta seviyedeyim."
        ),
        "experience": [
            {
                "period": "2021 - 2026",
                "title": "PR & Influencer Executive",
                "company": "Mint House",
                "bullets": [
                    "Influencer listeleri, barter surecleri ve lansman duyurulari icin icerik ekipleriyle koordine oldum.",
                    "Etkinlik sonrasi sosyal medya paylasim akislarini takip ettim.",
                ],
            },
            {
                "period": "2018 - 2021",
                "title": "Brand Communications Specialist",
                "company": "Common Studio",
                "bullets": [
                    "Basın bulteni, marka ortakliklari ve kampanya duyuru metinleri hazirladim.",
                    "Yorum yonetimi ve DM geri donusleri icin sosyal medya ekibine destek verdim.",
                ],
            },
        ],
        "skills": [
            "Influencer Iliskileri", "PR", "Etkinlik Duyurusu", "Topluluk Iletisimi",
            "Instagram", "TikTok temel", "Canva", "Brief Takibi"
        ],
        "education": "Yeditepe Universitesi - Reklam Tasarimi ve Iletisimi",
        "certifications": [],
        "languages": ["Turkce (ana dil)", "Ingilizce (B2)"],
        "key_strengths": [
            "Influencer ve topluluk tarafinda iletisim gucu",
            "Marka ortakligi ve duyuru akisi deneyimi",
        ],
        "key_risks": [
            "Performans takibi ve raporlama disiplini sinirli olabilir",
            "Gunluk operasyon sahipligi seviyesi teyit edilmeli",
        ],
    },
    {
        "series_key": "medium_design_video",
        "archetype": "Adjacent / orta",
        "headline": "Graphic Designer & Video Editor",
        "base_scores": {
            "role_experience": 54,
            "platform_tools": 66,
            "content_execution": 71,
            "analytics_reporting": 40,
            "community_communication": 58,
        },
        "summary": (
            "Sosyal medya icin gorsel tasarim ve video kurgu tarafinda gucluyum. "
            "Icerik fikri ve cekim tarafina destek veriyorum ancak tam kapsamli sosyal medya planlama ve raporlama deneyimim daha sinirli."
        ),
        "experience": [
            {
                "period": "2022 - 2026",
                "title": "Graphic Designer & Video Editor",
                "company": "Frame Craft",
                "bullets": [
                    "Instagram postlari, reels kapaklari ve kisa video kurgulari hazirladim.",
                    "Sosyal medya ekibinden gelen brieflere gore haftalik teslim planini yonettim.",
                ],
            },
            {
                "period": "2019 - 2022",
                "title": "Visual Content Designer",
                "company": "Mono Lab",
                "bullets": [
                    "Kampanya gorselleri ve story setleri hazirladim.",
                    "Canva, Illustrator ve Premiere Pro ile kreatif destek verdim.",
                ],
            },
        ],
        "skills": [
            "Canva", "Adobe Illustrator", "Photoshop", "Premiere Pro",
            "CapCut", "Story Setleri", "Reels Kapaklari", "Kisa Video Kurgu"
        ],
        "education": "Dokuz Eylul Universitesi - Grafik Tasarim",
        "certifications": [],
        "languages": ["Turkce (ana dil)", "Ingilizce (B1)"],
        "key_strengths": [
            "Kreatif uretim ve gorsel kalite katkisi",
            "Kisa video ve sosyal medya formatlarina asinaylik",
        ],
        "key_risks": [
            "Topluluk yonetimi ve yorum moderasyonu tecrubesi zayif",
            "Raporlama ve aylik performans okuma tarafinda gap var",
        ],
    },
    {
        "series_key": "low_crm_email",
        "archetype": "Dusuk uyum",
        "headline": "CRM & Email Marketing Specialist",
        "base_scores": {
            "role_experience": 28,
            "platform_tools": 30,
            "content_execution": 34,
            "analytics_reporting": 46,
            "community_communication": 42,
        },
        "summary": (
            "CRM akislari, email segmentasyonu ve lifecycle mesajlasmasi tarafinda calisiyorum. "
            "Sosyal medya ile sadece kampanya duyuru koordinasyonu seviyesinde temas ettim."
        ),
        "experience": [
            {
                "period": "2021 - 2026",
                "title": "CRM & Email Marketing Specialist",
                "company": "Loop Commerce",
                "bullets": [
                    "E-posta segmentasyonu ve lifecycle akislari olusturdum.",
                    "Sosyal medya ekibine kampanya mesajlari icin metin destegi verdim ancak hesap yonetimi yapmadim.",
                ],
            },
            {
                "period": "2018 - 2021",
                "title": "Marketing Automation Executive",
                "company": "Pulse CRM",
                "bullets": [
                    "A/B test ve open rate raporlari hazirladim.",
                    "Sosyal medya panelleri veya gunluk topluluk yonetimi sorumlulugum olmadi.",
                ],
            },
        ],
        "skills": [
            "CRM", "Email Marketing", "Segmentation", "Marketing Automation",
            "Basic Analytics", "Copy Support"
        ],
        "education": "Anadolu Universitesi - Isletme",
        "certifications": ["HubSpot Email Marketing"],
        "languages": ["Turkce (ana dil)", "Ingilizce (B1)"],
        "key_strengths": [
            "Mesajlasma ve kampanya metni tarafinda destek olabilme",
            "Rapor okuma ve temel analiz disiplini",
        ],
        "key_risks": [
            "Gunluk sosyal medya hesap yonetimi deneyimi yok",
            "Instagram, TikTok ve topluluk moderasyonu becerisi zayif",
        ],
    },
    {
        "series_key": "very_low_clinical",
        "archetype": "Cok dusuk uyum",
        "headline": "Dis Hekimi",
        "base_scores": {
            "role_experience": 6,
            "platform_tools": 8,
            "content_execution": 12,
            "analytics_reporting": 4,
            "community_communication": 18,
        },
        "summary": (
            "Klinik tarafta 10 yillik dis hekimligi deneyimim var. Kendi klinigimin Instagram hesabinda zaman zaman icerik paylasimi yapsam da profesyonel sosyal medya rolu deneyimim bulunmuyor."
        ),
        "experience": [
            {
                "period": "2016 - 2026",
                "title": "Dis Hekimi",
                "company": "Ozel Klinik",
                "bullets": [
                    "Hasta takibi, klinik operasyonu ve randevu sureclerini yuruttum.",
                    "Klinigin sosyal medya hesabina ara ara bilgilendirici paylasim fikirleri verdim.",
                ],
            },
            {
                "period": "2013 - 2016",
                "title": "Dis Hekimi",
                "company": "Agiz ve Dis Sagligi Merkezi",
                "bullets": [
                    "Klinik surecler ve hasta iletisimi uzerinde calistim.",
                ],
            },
        ],
        "skills": [
            "Hasta Iletisimi", "Klinik Operasyon", "Temel Instagram Kullanimi"
        ],
        "education": "Ankara Universitesi - Dis Hekimligi Fakultesi",
        "certifications": [],
        "languages": ["Turkce (ana dil)"],
        "key_strengths": [
            "Iletisim ve sabir gerektiren alan tecrubesi",
        ],
        "key_risks": [
            "Rolle ilgili profesyonel sosyal medya deneyimi yok",
            "Icerik takvimi, platform yonetimi ve raporlama becerisi yok",
        ],
    },
]


def register_fonts() -> None:
    pdfmetrics.registerFont(TTFont("ArialUnicode", FONT_REGULAR))
    pdfmetrics.registerFont(TTFont("ArialUnicode-Bold", FONT_BOLD))


def slugify(value: str) -> str:
    normalized = (
        value.lower()
        .replace("ç", "c")
        .replace("ğ", "g")
        .replace("ı", "i")
        .replace("ö", "o")
        .replace("ş", "s")
        .replace("ü", "u")
    )
    normalized = re.sub(r"[^a-z0-9]+", "-", normalized).strip("-")
    return normalized


def fit_label(score: int) -> str:
    if score >= 85:
        return "Guclu Uyum"
    if score >= 70:
        return "Uyumlu"
    if score >= 55:
        return "Kismi Uyum"
    if score >= 35:
        return "Dusuk Uyum"
    return "Uyumsuz"


def weighted_score(base_scores: dict[str, int]) -> int:
    weighted = (
        base_scores["role_experience"] * 0.34
        + base_scores["platform_tools"] * 0.24
        + base_scores["content_execution"] * 0.18
        + base_scores["analytics_reporting"] * 0.14
        + base_scores["community_communication"] * 0.10
    )
    return int(round(weighted))


def candidate_name(index: int) -> str:
    return f"{FIRST_NAMES[index]} {LAST_NAMES[index]}"


def candidate_email(name: str, index: int) -> str:
    return f"{slugify(name)}.{index + 1:02d}@examplemail.com"


def candidate_phone(index: int) -> str:
    return f"+90 53{(index % 7) + 1} {400 + index:03d} {10 + (index % 80):02d} {20 + (index * 3 % 80):02d}"


def build_expected_score(series: dict[str, Any], variant: LocationVariant) -> dict[str, Any]:
    base = weighted_score(series["base_scores"])
    overall = max(0, min(100, base + variant.overall_modifier))
    return {
        "role_experience": series["base_scores"]["role_experience"],
        "platform_tools": series["base_scores"]["platform_tools"],
        "content_execution": series["base_scores"]["content_execution"],
        "analytics_reporting": series["base_scores"]["analytics_reporting"],
        "community_communication": series["base_scores"]["community_communication"],
        "location_signal": variant.location_signal,
        "overall_score": overall,
        "fit_label": fit_label(overall),
    }


def styles() -> dict[str, ParagraphStyle]:
    sample = getSampleStyleSheet()
    return {
        "name": ParagraphStyle(
            "Name",
            parent=sample["Heading1"],
            fontName="ArialUnicode-Bold",
            fontSize=18,
            leading=22,
            textColor=colors.HexColor("#182033"),
            alignment=TA_LEFT,
            spaceAfter=4,
        ),
        "headline": ParagraphStyle(
            "Headline",
            parent=sample["Normal"],
            fontName="ArialUnicode",
            fontSize=10.5,
            leading=14,
            textColor=colors.HexColor("#475467"),
            spaceAfter=10,
        ),
        "section": ParagraphStyle(
            "Section",
            parent=sample["Heading2"],
            fontName="ArialUnicode-Bold",
            fontSize=11,
            leading=14,
            textColor=colors.HexColor("#1D2939"),
            spaceBefore=8,
            spaceAfter=4,
        ),
        "body": ParagraphStyle(
            "Body",
            parent=sample["BodyText"],
            fontName="ArialUnicode",
            fontSize=9.2,
            leading=13,
            textColor=colors.HexColor("#101828"),
            spaceAfter=4,
        ),
        "muted": ParagraphStyle(
            "Muted",
            parent=sample["BodyText"],
            fontName="ArialUnicode",
            fontSize=8.7,
            leading=12,
            textColor=colors.HexColor("#475467"),
            spaceAfter=2,
        ),
        "bullet": ParagraphStyle(
            "Bullet",
            parent=sample["BodyText"],
            fontName="ArialUnicode",
            fontSize=9,
            leading=12.5,
            leftIndent=10,
            bulletIndent=0,
            textColor=colors.HexColor("#101828"),
            spaceAfter=2,
        ),
    }


def paragraph_list(items: list[str], style: ParagraphStyle) -> list[Paragraph]:
    return [Paragraph(f"• {item}", style) for item in items]


def build_pdf(candidate: dict[str, Any], pdf_path: Path) -> None:
    doc = SimpleDocTemplate(
        str(pdf_path),
        pagesize=A4,
        leftMargin=16 * mm,
        rightMargin=16 * mm,
        topMargin=14 * mm,
        bottomMargin=14 * mm,
        title=f"{candidate['name']} - CV",
        author="Codex",
    )
    s = styles()
    story: list[Any] = []

    story.append(Paragraph(candidate["name"], s["name"]))
    story.append(Paragraph(candidate["headline"], s["headline"]))

    contact_table = Table(
        [
            ["E-posta", candidate["email"], "Telefon", candidate["phone"]],
            ["Lokasyon", candidate["location"], "LinkedIn", candidate["linkedin"]],
        ],
        colWidths=[22 * mm, 63 * mm, 20 * mm, 70 * mm],
        hAlign="LEFT",
    )
    contact_table.setStyle(
        TableStyle(
            [
                ("FONTNAME", (0, 0), (-1, -1), "ArialUnicode"),
                ("FONTSIZE", (0, 0), (-1, -1), 8.5),
                ("TEXTCOLOR", (0, 0), (-1, -1), colors.HexColor("#344054")),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("LINEBELOW", (0, 1), (-1, 1), 0.35, colors.HexColor("#D0D5DD")),
            ]
        )
    )
    story.append(contact_table)
    story.append(Spacer(1, 5))

    story.append(Paragraph("Profil Ozeti", s["section"]))
    story.append(Paragraph(candidate["summary"], s["body"]))

    story.append(Paragraph("Deneyim", s["section"]))
    for item in candidate["experience"]:
        story.append(
            Paragraph(
                f"<b>{item['title']}</b> - {item['company']}<br/><font color='#475467'>{item['period']}</font>",
                s["body"],
            )
        )
        story.extend(paragraph_list(item["bullets"], s["bullet"]))
        story.append(Spacer(1, 2))

    story.append(Paragraph("Beceriler ve Araçlar", s["section"]))
    story.append(Paragraph(", ".join(candidate["skills"]), s["body"]))

    story.append(Paragraph("Egitim", s["section"]))
    story.append(Paragraph(candidate["education"], s["body"]))

    if candidate["certifications"]:
        story.append(Paragraph("Sertifikalar", s["section"]))
        story.extend(paragraph_list(candidate["certifications"], s["bullet"]))

    story.append(Paragraph("Diller", s["section"]))
    story.extend(paragraph_list(candidate["languages"], s["bullet"]))

    story.append(Paragraph("Notlar", s["section"]))
    story.append(Paragraph(candidate["footer_note"], s["muted"]))

    doc.build(story)


def build_candidate_records() -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    index = 0
    for series in SERIES:
        for variant in LOCATION_VARIANTS:
            name = candidate_name(index)
            score = build_expected_score(series, variant)
            record = deepcopy(series)
            record.update(
                {
                    "candidate_index": index + 1,
                    "candidate_code": f"SM-{index + 1:02d}",
                    "name": name,
                    "email": candidate_email(name, index),
                    "phone": candidate_phone(index),
                    "location": variant.location,
                    "location_variant": variant.key,
                    "location_label": variant.label,
                    "location_note": variant.commute_note,
                    "headline": series["headline"],
                    "linkedin": f"linkedin.com/in/{slugify(name)}",
                    "footer_note": (
                        "Bu CV seti sosyal medya uzmanı rolü için manuel screening testi amacıyla üretildi. "
                        "Ayni seri icindeki adaylarda lokasyon farki bilerek korunmustur."
                    ),
                    "expected": score,
                }
            )
            records.append(record)
            index += 1
    return records


def build_markdown_table(records: list[dict[str, Any]]) -> str:
    lines = [
        "# Sosyal Medya Uzmani CV Paketi",
        "",
        "## Rol Varsayimi",
        "",
        f"- Rol: {JOB_BRIEF['title']}",
        f"- Lokasyon: {JOB_BRIEF['location']}",
        f"- Calisma modeli: {JOB_BRIEF['work_model']}",
        f"- Sirket tipi: {JOB_BRIEF['company_type']}",
        "- Ana beklentiler:",
    ]
    lines.extend([f"  - {item}" for item in JOB_BRIEF["core_expectations"]])
    lines.extend(
        [
            "",
            "## Skorlama Felsefesi",
            "",
            "- Overall skor role-fit agirlikli tutuldu; lokasyon sadece hafif bir modifier olarak ele alindi.",
            "- Lokasyon sinyali ayri kolon olarak verildi ki sistemin lokasyonu fazla agirlastirip agirlastirmadigi kolayca kiyasinlanabilsin.",
            "- Ayni seri icinde temel deneyim ayni seviyede tutuldu; lokasyon varyantlari karsilastirma icin bilerek tekrarlandi.",
            "",
            "## Beklenen Skor Tablosu",
            "",
            "| Kod | Aday | Seri | Lokasyon | Overall | Etiket | Rol/Deneyim | Platform | Icerik | Analitik | Topluluk | Lokasyon Sinyali |",
            "| --- | --- | --- | --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |",
        ]
    )
    for item in records:
        e = item["expected"]
        lines.append(
            f"| {item['candidate_code']} | {item['name']} | {item['series_key']} | {item['location']} | "
            f"{e['overall_score']} | {e['fit_label']} | {e['role_experience']} | {e['platform_tools']} | "
            f"{e['content_execution']} | {e['analytics_reporting']} | {e['community_communication']} | {e['location_signal']} |"
        )
    return "\n".join(lines) + "\n"


def write_outputs(records: list[dict[str, Any]]) -> dict[str, Path]:
    stamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
    pack_dir = ARTIFACTS_DIR / "social-media-cv-pack" / stamp
    pdf_dir = pack_dir / "pdfs"
    pdf_dir.mkdir(parents=True, exist_ok=True)

    for record in records:
        filename = f"{record['candidate_code'].lower()}_{slugify(record['name'])}_{record['location_variant']}.pdf"
        record["pdf_filename"] = filename
        record["pdf_path"] = str(pdf_dir / filename)
        build_pdf(record, pdf_dir / filename)

    csv_path = pack_dir / "expected-scores.csv"
    json_path = pack_dir / "expected-scores.json"
    md_path = pack_dir / "expected-scores.md"
    readme_path = pack_dir / "README.md"
    zip_path = pack_dir / "social-media-cv-pack.zip"

    with csv_path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(
            [
                "candidate_code",
                "name",
                "series_key",
                "archetype",
                "location",
                "pdf_filename",
                "overall_score",
                "fit_label",
                "role_experience",
                "platform_tools",
                "content_execution",
                "analytics_reporting",
                "community_communication",
                "location_signal",
                "location_note",
                "key_strengths",
                "key_risks",
            ]
        )
        for item in records:
            e = item["expected"]
            writer.writerow(
                [
                    item["candidate_code"],
                    item["name"],
                    item["series_key"],
                    item["archetype"],
                    item["location"],
                    item["pdf_filename"],
                    e["overall_score"],
                    e["fit_label"],
                    e["role_experience"],
                    e["platform_tools"],
                    e["content_execution"],
                    e["analytics_reporting"],
                    e["community_communication"],
                    e["location_signal"],
                    item["location_note"],
                    " | ".join(item["key_strengths"]),
                    " | ".join(item["key_risks"]),
                ]
            )

    json_payload = {
        "generatedAtUtc": datetime.utcnow().isoformat() + "Z",
        "jobBrief": JOB_BRIEF,
        "count": len(records),
        "files": [
            {
                "candidateCode": item["candidate_code"],
                "name": item["name"],
                "seriesKey": item["series_key"],
                "archetype": item["archetype"],
                "location": item["location"],
                "pdfFilename": item["pdf_filename"],
                "pdfPath": item["pdf_path"],
                "expected": item["expected"],
                "locationNote": item["location_note"],
                "keyStrengths": item["key_strengths"],
                "keyRisks": item["key_risks"],
            }
            for item in records
        ],
    }
    json_path.write_text(json.dumps(json_payload, ensure_ascii=False, indent=2), encoding="utf-8")

    md_path.write_text(build_markdown_table(records), encoding="utf-8")
    readme_path.write_text(
        "\n".join(
            [
                "# Social Media CV Pack",
                "",
                "Bu klasorde manuel test icin uretilecek 50 adet PDF CV ve beklenen skor tablosu bulunur.",
                "",
                f"- PDF klasoru: `{pdf_dir}`",
                f"- CSV skor tablosu: `{csv_path.name}`",
                f"- JSON skor manifesti: `{json_path.name}`",
                f"- Markdown ozet: `{md_path.name}`",
                "",
                "Notlar:",
                "- Ayni seri icindeki adaylarda lokasyon varyanti bilerek degistirildi.",
                "- Overall skor role-fit agirlikli tutuldu; lokasyon sadece hafif modifier olarak ele alindi.",
                "- PDF'ler secilebilir metin icerir; sisteme yuklendiginde parse edilmesi beklenir.",
                "",
            ]
        ),
        encoding="utf-8",
    )

    with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for pdf_file in sorted(pdf_dir.glob("*.pdf")):
            archive.write(pdf_file, arcname=f"pdfs/{pdf_file.name}")
        archive.write(csv_path, arcname=csv_path.name)
        archive.write(json_path, arcname=json_path.name)
        archive.write(md_path, arcname=md_path.name)
        archive.write(readme_path, arcname=readme_path.name)

    return {
        "pack_dir": pack_dir,
        "pdf_dir": pdf_dir,
        "csv_path": csv_path,
        "json_path": json_path,
        "md_path": md_path,
        "readme_path": readme_path,
        "zip_path": zip_path,
    }


def main() -> None:
    register_fonts()
    records = build_candidate_records()
    outputs = write_outputs(records)
    print(json.dumps({key: str(value) for key, value in outputs.items()}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
