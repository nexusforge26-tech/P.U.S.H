-- =============================================================================
-- ترحيل إصلاح روابط وصلاحيات Google Drive في جدول materials
-- 1) ربط 12 ملفاً كبيراً وعرضاً تقديمياً تم استعادتها ونسخها مباشرة إلى مستودع Drive الخاص بالمنصة
-- 2) تحويل 142 مادة كانت تشير إلى روابط خارجية (/file/d/...) لتشير إلى نسخها المرفوعة داخل مستودع Drive الخاص بالمنصة
-- 3) حذف 326 سجل مادة تالفة/مقفلة من المصدر الخارجي (مثل Past Exam collection - لغة عبرية ID 5903) أو مجلدات فارغة بلا ملفات
-- =============================================================================

begin;

-- 1) تحديث المواد الـ 12 التي تم نسخ ملفاتها مباشرة إلى مستودع Drive الخاص بالمنصة
update public.materials set drive_link = 'https://drive.google.com/file/d/1dOOXxNC31JXqyxmnYOUTVS-IbYx0VTfS/view', file_size = 117941785, mime_type = 'application/pdf' where id = 'e87dff88-3c57-53b6-926e-8f5a92228399'; -- [ID 1147] Notebook of Abstract Algebra 1 for first semester of 2021/2022
update public.materials set drive_link = 'https://drive.google.com/file/d/1528vCK3tJcRKvL_MZywW_0ECNQwgnpI2/view', file_size = 112556121, mime_type = 'application/pdf' where id = 'db95f830-aff2-5e13-9944-faefc96f8b5e'; -- [ID 1146] Notebook of calculas 3 for first semester of 2021/2022
update public.materials set drive_link = 'https://drive.google.com/file/d/1q_LBg8Z4Ro8qc3FpPDttDf0mflhiDhxX/view', file_size = 196294873, mime_type = 'application/pdf' where id = '3f1750ee-f807-5b8b-99f6-30f096cf3530'; -- [ID 61] Campbell Biology Book 12th - Biology for medical students book - كتاب الأحياء لطلبة الطب
update public.materials set drive_link = 'https://drive.google.com/file/d/1S5m5EwdH1he1DfGRCS7GpUyN6Jf90fh_/view', file_size = 606769, mime_type = 'application/vnd.openxmlformats-officedocument.presentationml.presentation' where id = '7ec3e656-bc48-5d3c-bbcf-e5977928d389'; -- [ID 199] اخلاقيات الحاسوب
update public.materials set drive_link = 'https://drive.google.com/file/d/1M1s6YK4GvUcyNkQq1jCaBlnkTN8TJAyv/view', file_size = 33143202, mime_type = 'application/x-zip-compressed' where id = 'a44f6ce7-2b0d-58bb-b9aa-aedd428e7cbf'; -- [ID 4059] Lecture notes
update public.materials set drive_link = 'https://drive.google.com/file/d/1jRqb-hsaop45ZhoNYHvjGflgaAqiOmKEoHeg2XlHMt8/view', file_size = NULL, mime_type = 'application/vnd.google-apps.presentation' where id = '20aff8b2-bf48-522c-9288-2dd608ecc0d9'; -- [ID 3219] المشروع الأول (دراسة لوظائف الحاسوب في محافظة الخليل)
update public.materials set drive_link = 'https://drive.google.com/file/d/1jAf62pUWkJfrp8Sm457ILBq60ArbY6OdHPCz8ZupZnM/view', file_size = NULL, mime_type = 'application/vnd.google-apps.presentation' where id = 'c3eeeccd-ee35-5055-9470-6a6e55053d22'; -- [ID 3220] المشروع النهائي (دراسة مشروع منصة تعليم إلكتروني)
update public.materials set drive_link = 'https://drive.google.com/file/d/1JmHl-z9kDzueGmVIDui9K5x9hl0K0ke2/view', file_size = 211512328, mime_type = 'application/x-compressed' where id = 'ea48fe3b-799e-5f01-ab58-9c38cb57b7f8'; -- [ID 4556] the second project
update public.materials set drive_link = 'https://drive.google.com/file/d/1jdO4Yvzwh3FyiEe8qXEtn-CGz7vhx1qv/view', file_size = 27852270, mime_type = 'application/x-zip-compressed' where id = 'd979de52-aa92-597b-b8cc-f2bd67e5b4a1'; -- [ID 4123] Ayman wazwaz all slides
update public.materials set drive_link = 'https://drive.google.com/file/d/18biGgjg7HwkE1lBvl3I7dHMerXSL_MNn/view', file_size = 127243873, mime_type = 'application/pdf' where id = '323c50d9-441a-5e74-8798-2b1b0c4797fa'; -- [ID 1150] Notebook of Real Analysis 1 for first semester of 2021/2022
update public.materials set drive_link = 'https://drive.google.com/file/d/1OGRetnzvqingQ8shCpsWDI97G6tGqGoG/view', file_size = 32840414, mime_type = 'application/vnd.openxmlformats-officedocument.presentationml.presentation' where id = '56df9bb8-ebd0-5c43-88ef-faf4db429176'; -- [ID 2961] presentation about windows server
update public.materials set drive_link = 'https://drive.google.com/file/d/10QlxnEOg5OsdwVFE9HowrjhyZCYzhsNu/view', file_size = 83953752, mime_type = 'application/x-zip-compressed' where id = '9699ee01-dc12-5862-80b0-af0a29bf8dfb'; -- [ID 4133] stl files all exams and homeworks files

-- 2) تحويل 142 مادة من روابط خارجية إلى مجلداتها المرفوعة داخل مستودع Drive الخاص بالمنصة
update public.materials set drive_link = 'https://drive.google.com/drive/folders/1vclt2ycMg-YKMH3L8A4YyZ6a9arCPcU9' where id = '2c80c42b-d836-5dfc-82c2-5355f8f4a6eb'; -- [ID 2110] Williams&#39; Basic Nutrition and Diet Therapy (Book)
update public.materials set drive_link = 'https://drive.google.com/drive/folders/1DuZe65Oh7ExTyG6HwEq0tfWCXeISrk2C' where id = '000efaff-eb80-5ec2-a518-7c84fd5a25a6'; -- [ID 2111] Review of Pathology (Book)
update public.materials set drive_link = 'https://drive.google.com/drive/folders/1xp6mVuxMfUClwgivLw0bW72PVErIvn5F' where id = '5510aeb0-46ff-5384-9518-1964ead2fcc1'; -- [ID 2112] Review of Pathology (Book)
update public.materials set drive_link = 'https://drive.google.com/drive/folders/1bv_7KefrmYCSDEBwHIvzM-uCKPYNaZaP' where id = '0408ab45-3b0e-582a-9f91-2a66c3af1d19'; -- [ID 2113] Review of Pathology (Book)
update public.materials set drive_link = 'https://drive.google.com/drive/folders/1XrSniZ-svvFSsbesRIT2XOjMMdQAKmnU' where id = 'a82796cd-5115-5576-a361-49d4fa57bd06'; -- [ID 2114] Review of Pathology (Book)
update public.materials set drive_link = 'https://drive.google.com/drive/folders/1v7DYHVca-4n_c9PnLGTKQ-jCqwv6kJ_I' where id = 'eaa00860-4b99-5529-aa52-54db1fffaeb5'; -- [ID 36] كتاب اتجاهات حديثة في تربية الطفل
update public.materials set drive_link = 'https://drive.google.com/drive/folders/125e2Xjy8o1HJSyzX_lcEjLOkuSwE5OZO' where id = 'e8d3cb9e-8dbb-50e1-9017-45c2e5984785'; -- [ID 39] Final
update public.materials set drive_link = 'https://drive.google.com/drive/folders/1KtkTCiVhQKKfB83PAkrHw9FL4QE5EoQn' where id = 'c18345d0-10e7-5103-9f41-78be5e2fba64'; -- [ID 37] كتاب العنف ضد الاطفال
update public.materials set drive_link = 'https://drive.google.com/drive/folders/1e-3Op8Qk25RMdJXelZjsAFp4_a42sHGg' where id = '6916b5f4-a0ea-542e-9a52-f1e0d1ba2644'; -- [ID 1160] Complex Analysis
update public.materials set drive_link = 'https://drive.google.com/drive/folders/1Drmtw8mgHa5oUSg0hG_WU5Ev9-NgA0p7' where id = '69fa3824-2d61-58d1-8b83-c70b72fca18d'; -- [ID 1159] Complex variables and applications
update public.materials set drive_link = 'https://drive.google.com/drive/folders/1siTpbIgNwTAKistfojwdVYdrBJDRVA7h' where id = 'cd8a3714-0ec5-5eee-ad6f-f4a086cb8538'; -- [ID 2102] تلخيص جزء ١
update public.materials set drive_link = 'https://drive.google.com/drive/folders/1k9FcUgdBr82BjU9S3L7iu_9gk10HaRDk' where id = '3b2a9f97-b383-5348-95b0-4f0f20980d63'; -- [ID 41] كتاب علم النفس التطوري
update public.materials set drive_link = 'https://drive.google.com/drive/folders/1Sx-ftPXIEQ1M2bqwzkHRh-bi45liHYUH' where id = '07054e32-ffff-59de-9a9e-52a2dbbe704f'; -- [ID 2894] فيزياء التصوير الطبي
update public.materials set drive_link = 'https://drive.google.com/drive/folders/1yJULE9OG6pP-lrAIQzqcuXuabRgcvqeM' where id = 'fc8bb3de-eae6-503c-9d36-733c88b2f758'; -- [ID 2899] Introduction to solid state physics
update public.materials set drive_link = 'https://drive.google.com/drive/folders/1Isnu0G3-aH2mE4kRMOIFu8aaOOzn5Q4T' where id = '142dddf7-9ad2-5890-ad6f-389e0293836c'; -- [ID 2897] Thermodynamics
update public.materials set drive_link = 'https://drive.google.com/drive/folders/1Wmtl0BwGaUzvP9_hpXdRz4Kr3A142DE1' where id = 'a58b9bec-1570-5160-88cd-2718337144a5'; -- [ID 868] Complex numbers
update public.materials set drive_link = 'https://drive.google.com/drive/folders/1f9LecvtTXLWs-bsS-FUV246J41walYgN' where id = '7f686da2-4672-53c9-8f91-c1ec2c2b134e'; -- [ID 869] Complex numbers problems
update public.materials set drive_link = 'https://drive.google.com/drive/folders/1GAkZs3nzysRRnlDiWoHgjEIaR0C66JfM' where id = 'e925e181-551a-5b93-a501-f94ed53000d1'; -- [ID 872] Fourier series
update public.materials set drive_link = 'https://drive.google.com/drive/folders/1czhF58-CLzGm3Yp4AgOV4rurEr5FcJVw' where id = 'f9112d94-3754-5f55-a52b-f3261ce949c9'; -- [ID 873] Fourier series problems
update public.materials set drive_link = 'https://drive.google.com/drive/folders/1eiOlvB4UAD1qmpw7Fvvb_G7EbW3WoRLB' where id = 'f6fceacf-c49d-5b4a-a964-7da0c417169a'; -- [ID 870] Linear algebra
update public.materials set drive_link = 'https://drive.google.com/drive/folders/1UUyaGiKbhtdVHnlSdGJ2X9NMJCslgZw4' where id = 'a28b181b-2c61-513d-a51c-5616f03c9637'; -- [ID 871] Linear algebra problems
update public.materials set drive_link = 'https://drive.google.com/drive/folders/1lUEat8kbsQTr3M5YEeRPp_hF6KL0cSic' where id = 'f0d36526-0cd1-596d-83ac-3ab5e94980c2'; -- [ID 874] Special functions
update public.materials set drive_link = 'https://drive.google.com/drive/folders/1OwNxjx--KCt97qKoY5xAGBsxlM4T_gXc' where id = 'df1d236b-c21e-58ae-97c9-aaf64d733465'; -- [ID 875] Special functions problems
update public.materials set drive_link = 'https://drive.google.com/drive/folders/1INbM2Qa2FjYNUxGzgOjjwlHfGK8dsyM-' where id = '152121e8-006f-5b99-ae43-c3f6e4394571'; -- [ID 889] Chapter2
update public.materials set drive_link = 'https://drive.google.com/drive/folders/1ClbzQejpmEcWvFcTzgbAtOkVAyvRRRys' where id = '70e1b7c8-719f-5fd1-860e-ee762f92a425'; -- [ID 890] Chapter3
update public.materials set drive_link = 'https://drive.google.com/drive/folders/140PI89jKbblIRFygjvtrNIIE3P2OpTwn' where id = '73735547-a70f-52fa-bca7-b95e2379718d'; -- [ID 891] Chapter4
update public.materials set drive_link = 'https://drive.google.com/drive/folders/1sIJbWRxC-tsnyj5ovKrkJIlzLtooh-sA' where id = '2382d6cf-8b43-5d8f-bf8a-7f3ed6e2cb8c'; -- [ID 888] ‏chapter1
update public.materials set drive_link = 'https://drive.google.com/drive/folders/11lhKBpEhWM5ohGZuWElc71kpvhVQPvOU' where id = 'd71d6904-59b5-525e-9397-3a345763957e'; -- [ID 2896] ميكانيكا الكم
update public.materials set drive_link = 'https://drive.google.com/drive/folders/1XWFAkkDor_gmwvrJZWyfKpM8Hg1PtPPq' where id = '8989f494-b353-5d54-b77d-9cf11515ebe1'; -- [ID 849] Chapter1
update public.materials set drive_link = 'https://drive.google.com/drive/folders/1Yqfkeshc8GBQC8r2DnFYgpt8GOlP7njS' where id = 'd17eb8c0-6b17-55a3-9866-bb708faf4aa4'; -- [ID 850] Chapter2
update public.materials set drive_link = 'https://drive.google.com/drive/folders/15RgKTzdqFX6_V62ZqXVbxtnVdxPV8Coc' where id = 'ef9335fc-18d8-59ec-b07f-96100174db1a'; -- [ID 851] Chapter5
update public.materials set drive_link = 'https://drive.google.com/drive/folders/1dtYPCASRwQ25TD_tAJxoXBsqWhgMTuYD' where id = '23852058-584a-5c9b-8ce7-a85e0f720e1e'; -- [ID 852] Chapter6
update public.materials set drive_link = 'https://drive.google.com/drive/folders/10JpBbMfIJcM59bRXhrvVIUYJS2dKiOSS' where id = '8638180d-3fa4-5ec5-9bee-e5f7018997fe'; -- [ID 853] Chapter7
update public.materials set drive_link = 'https://drive.google.com/drive/folders/1ZYJW2EM7eDgoJPmP8-n6BbniVYkTbq9E' where id = '7969a2af-9ee4-5b34-bd6f-910a2c854516'; -- [ID 1149] Notebook of Euclidean Geometry for first semester of 2021/2022
update public.materials set drive_link = 'https://drive.google.com/drive/folders/1U0I0TZxNVZxtLUdm1b7-xgRuvU1VNvfb' where id = '93f8818b-77d3-584a-b2ea-5d68a1a39a3f'; -- [ID 200] اخلاقيات الحاسوب
update public.materials set drive_link = 'https://drive.google.com/drive/folders/1CuA2lj7CyIdteAtQfJuDSjjs02z-br4J' where id = '331726f4-2bc1-5b73-8a28-8909f2e45534'; -- [ID 5907] ملخص لكورس التفكير النقدي
update public.materials set drive_link = 'https://drive.google.com/drive/folders/1Fyz-8hj2pdQcDCxQYWzS3G_FFn8TwIle' where id = '34d130a0-32d2-5ddc-9991-76b1e2d0d3cb'; -- [ID 3424] مادة الميد صيفي 2024
update public.materials set drive_link = 'https://drive.google.com/drive/folders/1ldyyJh6qxwP1YW_ebn1u2QroCK9mfZdA' where id = '444410d9-5740-5d71-bc6d-f073131d9167'; -- [ID 4060] Lab homeworks
update public.materials set drive_link = 'https://drive.google.com/drive/folders/1qN-tZKckMAA3lYb7KMYaP-Gk-oXpJegl' where id = 'f5f00830-e922-56ef-a5d0-b75f16aa9e81'; -- [ID 38] تلخيص ادارة الجودة الشاملة
update public.materials set drive_link = 'https://drive.google.com/drive/folders/1ljhWrUcklHC2xwtBP-bYj3qZdZ1ZYzwR' where id = 'daafaf6a-8290-5d08-9f04-a116f6426fba'; -- [ID 32] تلخيص ادارة موارد بشرية نهائي
update public.materials set drive_link = 'https://drive.google.com/drive/folders/1fawL8ScTpzpmDI5yOv2zbWTISFxCvEpn' where id = '05f61c63-c539-50de-8a98-cce75a966d84'; -- [ID 2100] Chapter 1
update public.materials set drive_link = 'https://drive.google.com/drive/folders/184r8UM9QplqUQiWodCkkA4S07Fl4uCC0' where id = '19d721c8-6119-5f53-83e3-88d36a954bf7'; -- [ID 2101] Chapter2
update public.materials set drive_link = 'https://drive.google.com/drive/folders/1mnz0Ftp4ZZYl-DbeaJPMnEfjKzoORlAc' where id = '328e814f-8824-516a-9db8-be70e041aa4b'; -- [ID 2147] Continuous distributions
update public.materials set drive_link = 'https://drive.google.com/drive/folders/1VjKCgrnq9y7CCFtTGr1hpqk4nxkhmfVR' where id = 'd6bfaaab-5724-530e-9f6e-f375fc8751ec'; -- [ID 2154] Introduction to sampling theory
update public.materials set drive_link = 'https://drive.google.com/drive/folders/1LAKx5PncVZIRrVPQ4oOJhxTPY8KX46IF' where id = 'acad680d-0fd3-52a5-9a06-d8e88316afe3'; -- [ID 2139] Mathematical expectations & discrete probability distribution
update public.materials set drive_link = 'https://drive.google.com/drive/folders/1_j9SLwqVD311FLtD1zEdduNxvH8V0j2v' where id = '446e8c03-6617-5fac-96ec-bde9dba6c3c5'; -- [ID 2138] Random variables & probability distribution
update public.materials set drive_link = 'https://drive.google.com/drive/folders/1SCeQDMoxfNH4D2WX0dFt7VZrjdV-t6Pp' where id = '36b6dc30-0a81-5774-a16e-66a2699feef1'; -- [ID 2155] Testing statistical hypothesis
update public.materials set drive_link = 'https://drive.google.com/drive/folders/1QHxGxg8aWvsmDE6qXTRLV-QsiAHK-UmP' where id = '26990fa7-1019-5900-85c6-913e702bf659'; -- [ID 912] Electronics Summarization
update public.materials set drive_link = 'https://drive.google.com/drive/folders/1o_r1_v_VlfF2mGUI7f0AT5sZbC_QX7zq' where id = '3969dd65-ea57-5e91-841c-ea23043aa19d'; -- [ID 1849] تلخيص مادة الفيرست
update public.materials set drive_link = 'https://drive.google.com/drive/folders/18az95S5hlCWeMZOBkcH-r16aKqm_DmES' where id = '52a2ad9a-f541-50ef-87d7-185404f4fd1d'; -- [ID 101] Anatomy Abdomen Sameh Doss summary
update public.materials set drive_link = 'https://drive.google.com/drive/folders/1fXrF9C6XAFToISm_R6Uk1DwJgquQavSY' where id = 'd2799ecf-6333-563c-9731-ea9ae6e380c4'; -- [ID 102] Anatomy SD Pelvis Sameh Doss summary
update public.materials set drive_link = 'https://drive.google.com/drive/folders/1opiMBxOaqsami3UfhBbShBtB3TFa52j3' where id = 'd52ea63f-d712-5768-aa21-d4677b00ef5b'; -- [ID 103] Anatomy Thorax Sameh Doss summary
update public.materials set drive_link = 'https://drive.google.com/drive/folders/1kzWDQVLkBOSRKXNJzEMYycm2ggCEJlF3' where id = '6dd1a554-54d3-5491-9126-3d1046a82609'; -- [ID 99] abdomen summary anatomy
update public.materials set drive_link = 'https://drive.google.com/drive/folders/1tJpbaQpjL8bsvVpOntqhMrpRINPwErdy' where id = 'b7d7a9f1-f5c6-58f5-82b0-47f2ec94aec8'; -- [ID 98] chest wall summary anatomy
update public.materials set drive_link = 'https://drive.google.com/drive/folders/1j9pgkyZinyhKpfanTWU74RNuIUKBfkcv' where id = 'e9e4450f-a0ab-5688-8cb8-23ba9ff3485a'; -- [ID 100] thorax summary anatomy
update public.materials set drive_link = 'https://drive.google.com/drive/folders/1XjIxx7wlh9dKOr_iajAUmuAWbVDHTUKm' where id = '6bc1045d-3986-5075-bbc7-44be457f5c2b'; -- [ID 2895] Particle physics
update public.materials set drive_link = 'https://drive.google.com/drive/folders/1uEz_8X_jHnZQ4pswUsEqQXAvXGdkVDXQ' where id = '5cf11143-ca6e-5e5b-bda4-c500a5a08292'; -- [ID 34] 
update public.materials set drive_link = 'https://drive.google.com/drive/folders/17WCeAzYoRqWuZfRn4e21Fz5f1LxBQE57' where id = '4f178f1b-7eb7-5f22-9f31-19c28e8fd32b'; -- [ID 4578] All homeworks and all lecture excersises
update public.materials set drive_link = 'https://drive.google.com/drive/folders/14TU3e1a-Rqd_OQeCla-BUE2g_WYOwHtu' where id = '50f6c7fe-a693-5f86-844f-fa29c3d7f02a'; -- [ID 4579] final exam autocad file
update public.materials set drive_link = 'https://drive.google.com/drive/folders/1X9QxM6kyu2MfwqmS7H_WsbKrh8DndcXq' where id = '68a2c71c-9f76-5d8b-9e74-ca86ca574278'; -- [ID 2898] Computational physics
update public.materials set drive_link = 'https://drive.google.com/drive/folders/1F2BuH97eOH2qsIATV50hSPBI16VDzS7f' where id = '4ef1c9aa-3d69-5a49-9dcc-aded7d4b7b85'; -- [ID 1545] تلخيص الكترونيات 2
update public.materials set drive_link = 'https://drive.google.com/drive/folders/1VxMZFhdqpPKEnkdQEPY8fzurWVU-_avz' where id = '6281a960-ee1c-5b2d-a536-97abce460156'; -- [ID 4555] the first project
update public.materials set drive_link = 'https://drive.google.com/drive/folders/1RinoSouS78_Yx_1fgTnkxK4CB4Onwv7X' where id = '6d304b7c-fa4f-5547-80ac-16e950af5ae9'; -- [ID 2137] لغة عربية
update public.materials set drive_link = 'https://drive.google.com/drive/folders/1L-tjR-vFa0w6FmOn8ZP9MH1K6KOyvOIm' where id = 'bbb30fe5-df08-5694-a8f1-22abfcfc3612'; -- [ID 4121] 8 bit calculator final project
update public.materials set drive_link = 'https://drive.google.com/drive/folders/1_da_fZOcwpNtEGWlLiLRo6xWj53laziF' where id = '184b25f9-eb6b-566f-89a2-07e8701d2c77'; -- [ID 4122] all  programming homeworks
update public.materials set drive_link = 'https://drive.google.com/drive/folders/17oLb4YD8nPRwVT8OLwZP0uehaeW8o4-v' where id = '61f8fa17-cd89-5d68-94b7-7e81b8a78d65'; -- [ID 4975] hw 1
update public.materials set drive_link = 'https://drive.google.com/drive/folders/1F46ieOOrdNk6IjzJsDTJbfOgixEm15hn' where id = '7cf0cbab-6918-5bd1-b7d5-34a522ae2dc1'; -- [ID 4976] hw 2
update public.materials set drive_link = 'https://drive.google.com/drive/folders/1tCMXhs9C6pCRG7dMFEzSwPcnk7dPGmX9' where id = 'fffdd1b6-1c02-5611-b2a0-c82060167a84'; -- [ID 4977] hw 3
update public.materials set drive_link = 'https://drive.google.com/drive/folders/1onvryJklb8i5i3r819koei77PhnRLbPv' where id = 'a460788e-45b9-5932-aaca-2124172e6027'; -- [ID 4264] حلول تمارين الكتاب
update public.materials set drive_link = 'https://drive.google.com/drive/folders/1Kov5eVUa776Jq7PuzLmfnmGHHF6QuWuj' where id = 'ff5b3f0c-e2c2-56bf-abc3-c3110d1c088c'; -- [ID 2103] تلخيص منطق رقمي 2022
update public.materials set drive_link = 'https://drive.google.com/drive/folders/1MwrszR4Cxaa9zgOs0ObE2BHJXQWf9j-a' where id = '35ee808b-2271-5aab-bd52-e9d3b930a89e'; -- [ID 5710] امتحانات تاريخ فلسطين الحديث
update public.materials set drive_link = 'https://drive.google.com/drive/folders/1luqCzANZqgQn3K4JwEL4_cD3WbbjrRf_' where id = 'bd3f1592-75d8-5391-95bc-f63724cc6ec4'; -- [ID 410] تلخيص تحليل عددي كامل
update public.materials set drive_link = 'https://drive.google.com/drive/folders/1Iok5Ohfe5GowqoOJc0K5nB_u9kwc69AJ' where id = '8e99856b-e8db-5a8a-85db-b87271650047'; -- [ID 995] First
update public.materials set drive_link = 'https://drive.google.com/drive/folders/1FLkv4oM0vaeznayzYogP03cvN5hILkD6' where id = '35b2d641-ec1e-5158-a3b7-69f5b69589f3'; -- [ID 2995] تلخيص خوارزميات
update public.materials set drive_link = 'https://drive.google.com/drive/folders/1ubbuIx-TV20T2_7iMW71HETJpbo5AuPu' where id = '1f85877f-8ee6-5b80-add0-c7c3fc7aa8cb'; -- [ID 4558] Final Project
update public.materials set drive_link = 'https://drive.google.com/drive/folders/12z_hmcbB5Qpxm0Sx90XY8meW8LhgIofo' where id = '404d3d16-500b-557e-bac1-6a01fbc74dcc'; -- [ID 4563] Lab Lectures
update public.materials set drive_link = 'https://drive.google.com/drive/folders/1EidTEtbWwhfJa_9pQVOw0fXEU3ZHv3yl' where id = 'd2dae804-e045-5956-819a-44edfa5e5fa6'; -- [ID 31] Calculus 1 - تفاضل وتكامل 1
update public.materials set drive_link = 'https://drive.google.com/drive/folders/1n-A_uadhe0hWdphhYbp9ni8m3W375YuU' where id = '272446e6-9758-5f17-ab92-06f5141154a5'; -- [ID 3661] Ch4
update public.materials set drive_link = 'https://drive.google.com/drive/folders/13orB7cf_JaZDGoN-NqvrTLLZRTivH0mW' where id = 'fa6600b9-d3b2-5bfb-b304-a3d7d53b682a'; -- [ID 5426] اسئلة
update public.materials set drive_link = 'https://drive.google.com/drive/folders/1IBNsicI-VUiaDE3MRlcPoRHe0ieb_n9M' where id = '9db8e0f2-25a5-5c88-a077-49bfbf85a70c'; -- [ID 907] First
update public.materials set drive_link = 'https://drive.google.com/drive/folders/1z8-KnJSEOQmuzkt8Wn1I4nMtcMlVT-Jc' where id = '23c8ed4d-f9ac-54d7-8d4e-a1cbb0c02f1a'; -- [ID 3984] امتحان ميد 2024
update public.materials set drive_link = 'https://drive.google.com/drive/folders/1n0FXeMrzl9XfJYbANFrjGw5h06j3U9eU' where id = '0121b879-7644-55af-a413-b6207c85d4d2'; -- [ID 35] 
update public.materials set drive_link = 'https://drive.google.com/drive/folders/1izF-JiAMG3MfPkeCJvQs6-4E9_FOCSlw' where id = 'ab4e1de8-5838-59aa-8478-2761505332d3'; -- [ID 40] كتاب ثقافة اسلامية (ليس الكتاب المعتمد)
update public.materials set drive_link = 'https://drive.google.com/drive/folders/1wMiQeLolZJy5AKemWSJN7BnH0m9J2PmG' where id = '3e91d4f0-fb66-5b62-b502-1f58c8be5f6b'; -- [ID 33] Final
update public.materials set drive_link = 'https://drive.google.com/drive/folders/1ewQZaWGWK3zKLhxFyoo9l5LhhtKDah38' where id = '22a6e3e1-ceed-5cd2-8dcd-4a280621fe57'; -- [ID 3417] تلخيص طلاب ل  المادة من اول الفصل ل محاضرة 2/7 معدا المحاضرة الاولى .
update public.materials set drive_link = 'https://drive.google.com/drive/folders/1vbHoEXFOch2aqsL6iyqXgLT8O0AEfJwY' where id = 'e8cf80c4-2330-5ac1-925a-c1a0d531a623'; -- [ID 3422] فيرست
update public.materials set drive_link = 'https://drive.google.com/drive/folders/1paLwQP5f57RjCYH_An3NFBKHhjaTqVws' where id = '4f7c01eb-ac26-57ed-9201-8e19f9023614'; -- [ID 3416] كتاب الثقافة الطبعة الجديدة ٢٠٢٤
update public.materials set drive_link = 'https://drive.google.com/drive/folders/1YxR7SdyfVaPBhuRK-Q2sD5CPlDhbO1Zh' where id = '724b815e-3a74-5520-a4cd-af2dcffc2c33'; -- [ID 3756] subnetting homeWork
update public.materials set drive_link = 'https://drive.google.com/drive/folders/1-sB2uIquKCySDwGXy7B7VPnY6YGctewL' where id = 'c1dc507e-e7cd-595b-8c44-143411bcfbd1'; -- [ID 3339] Adipose tissue
update public.materials set drive_link = 'https://drive.google.com/drive/folders/12maJehz9r8-I5QhBPXf8ZtJfrvecLRnn' where id = 'e74c6181-609f-5dff-9c39-a8ea3307a335'; -- [ID 3347] Bone tissue
update public.materials set drive_link = 'https://drive.google.com/drive/folders/1tf3h6bTpHeVriVf4iAmu1dPi_uy1J5Kv' where id = '9f7bcf92-87ad-5959-9e74-2d9e513d1392'; -- [ID 3346] Cartilage
update public.materials set drive_link = 'https://drive.google.com/drive/folders/1pXeSYaOeHQ0Q5HiiUVsy3H0Lg4yH-Y5w' where id = 'c555117b-c27c-521e-81f4-7e3d3fec3e5d'; -- [ID 3342] Ch12 Blood
update public.materials set drive_link = 'https://drive.google.com/drive/folders/1cQu1rxjTUP-3S88qMMO0QxsZGOP5DVGC' where id = '8d8eeb50-54b7-59fe-9527-b7b5c1dfb8ae'; -- [ID 3348] Ch3AThe nucleus
update public.materials set drive_link = 'https://drive.google.com/drive/folders/1nE4w2Dj89av_a_k6Qj_rGenL7JAB9bcq' where id = '3a47a31b-b6a9-556a-95b4-cbe1eb9386ae'; -- [ID 3341] Ch4 Epithelial Tissue
update public.materials set drive_link = 'https://drive.google.com/drive/folders/1CXGr90caMUhaswkkk5FihMuwGHNDmX5z' where id = 'd83d8578-cc88-557f-8232-6dbda8d4034f'; -- [ID 3337] Connective tissue 1
update public.materials set drive_link = 'https://drive.google.com/drive/folders/1eodVT3jAsztZR-1vYOdycKeW8yWP-Xi5' where id = 'a0f9293b-ac4e-5cf9-96c1-ffde82c711c6'; -- [ID 3338] Connective tissue 2
update public.materials set drive_link = 'https://drive.google.com/drive/folders/1MehwTwi_ukscDyiyypFpdpJt0aqj1rVy' where id = '1d20ef3c-b4d1-5a1d-913b-9105ed996aee'; -- [ID 3344] Connective tissue تلخيص
update public.materials set drive_link = 'https://drive.google.com/drive/folders/1O__oZqfXKFOonwRNOhmwekaNRFK_mRgi' where id = 'a307f6b6-aaa1-5c7a-8f55-c980122c4cfe'; -- [ID 3345] Histo epithelium تلخيص
update public.materials set drive_link = 'https://drive.google.com/drive/folders/1wPB_VXKS90tusVnvPwaP-FQvtNZT8IJc' where id = '61e7c8df-ada8-5486-8109-600372f798f8'; -- [ID 3340] Muscle tissue
update public.materials set drive_link = 'https://drive.google.com/drive/folders/1eHwr7O9C6Wg7sazkIp27bZQtWVk-aAjV' where id = 'd76f1fce-a1fe-529f-aad7-b2716d7720fe'; -- [ID 3343] Nerve tissue and the nervous system
update public.materials set drive_link = 'https://drive.google.com/drive/folders/1xAcsw0ELK2fbfl2-6YJBcOVSj82X-C_k' where id = '6cd1b618-986b-5e2b-9786-a10a60b5d9e7'; -- [ID 54] سلايدات الفيزياء الحيوية - BioPhysics slides
update public.materials set drive_link = 'https://drive.google.com/drive/folders/13JfzYzY7ZXP16nRcVPKtLyOsc0JusbWm' where id = 'c1a549ea-1fcc-5919-8ac3-5183ccacc66b'; -- [ID 3715] كتاب كيمياء
update public.materials set drive_link = 'https://drive.google.com/drive/folders/1XAD539PspTsbh2_svbECANNudpgl3X7x' where id = '72a97533-ca93-512c-a607-5ca5c48029d2'; -- [ID 106] cambridge lms exam
update public.materials set drive_link = 'https://drive.google.com/drive/folders/1D9qpKTKvByZwr3AW28jiPC2sWC1b0QEV' where id = 'ad4eede8-3ff2-5239-85aa-620cbb565673'; -- [ID 2156] تلخيص لمادة اللغة العبرية
update public.materials set drive_link = 'https://drive.google.com/drive/folders/1W7HbqShujV1aPCSTvSaK1FnTR2DwPlY7' where id = '54e12ffd-70c7-5f76-bef6-835afe76df56'; -- [ID 3415] كويز
update public.materials set drive_link = 'https://drive.google.com/drive/folders/1CMwmJvjLA2a0xD30bll88xwq4hlxnt56' where id = 'a8a0a98e-f837-5c33-8c1a-9b531d6141e5'; -- [ID 3423] كويز
update public.materials set drive_link = 'https://drive.google.com/drive/folders/1pPIo4y1Qn-ewQiw-IwLjVUhaDscw_eRR' where id = '0b4be0dc-9b10-54e6-954b-64c68b74cdd8'; -- [ID 44] 
update public.materials set drive_link = 'https://drive.google.com/drive/folders/1Vid73Zo9LzIEEVeDdFxJo6MvSKY_5vFD' where id = 'c74be4cc-8774-54d4-a469-8c6415c1c36a'; -- [ID 4574] fINAL AND MIDTERM EXAMS
update public.materials set drive_link = 'https://drive.google.com/drive/folders/1fP_BxgNSvQWFEc_e9kKI9qq_G0nUsGtO' where id = '32c2f8d7-d911-5b8e-bfaa-f4ad195020df'; -- [ID 4076] All required dataasheets
update public.materials set drive_link = 'https://drive.google.com/drive/folders/1aiJPERe9fRVqnBODnhk-N5Jn9dV6ljvp' where id = 'd8d746b6-3eef-545e-8741-beb39d41e2d3'; -- [ID 4077] Digital Lab final project
update public.materials set drive_link = 'https://drive.google.com/drive/folders/1xEQagYx9eD8zN1C8B0ssQGuNcN0xX6gH' where id = '73e17848-02bf-53d2-8c2a-96c4c89c726a'; -- [ID 4222] مشروع
update public.materials set drive_link = 'https://drive.google.com/drive/folders/1G9q7-SfSDUoHL-H8-nNtG2j4SQjk0Jmg' where id = '852763ac-c88e-5a79-8f4f-f80a95d86731'; -- [ID 3353] 4 Thoracic Wall
update public.materials set drive_link = 'https://drive.google.com/drive/folders/1Vy3rjUc6DmjVPqWfJBxbFloD6ePzlKSo' where id = '6350882e-ace0-5bcd-b610-0145a7813f23'; -- [ID 3352] 5 The Heart
update public.materials set drive_link = 'https://drive.google.com/drive/folders/1DQaK4urJBvqU7F9aLVSp99plpXaYFfET' where id = 'c84321bb-066e-5191-9575-6414b1b02463'; -- [ID 3351] Respiratory System
update public.materials set drive_link = 'https://drive.google.com/drive/folders/1Xpzov08zJzpErcnCtmTE6SHITL1mYIrw' where id = '5060ac2c-9c71-5a5c-b295-8336726283d6'; -- [ID 3354] ‘Vertebral Column
update public.materials set drive_link = 'https://drive.google.com/drive/folders/1vp3zf2n59ijaPujJ0wUgSG5lTvpbTu3o' where id = 'e04b800d-7614-5b53-8e15-fe0bb4a51677'; -- [ID 3350] Discussions for biochemistry lab
update public.materials set drive_link = 'https://drive.google.com/drive/folders/1qzTZqobjUAm6QoyYr-9cfrqZK1TS0suM' where id = '416d3e4e-8276-550f-9a02-5ff7504f8105'; -- [ID 4126] HW2 Pic lab
update public.materials set drive_link = 'https://drive.google.com/drive/folders/1FzG4h9ppXG4rtS-gHNGJ63FfvXmV-E-8' where id = '12a55423-d9f6-5b1b-8d3a-c35838d28d4a'; -- [ID 4581] KP
update public.materials set drive_link = 'https://drive.google.com/drive/folders/1LtF6dqoZenc7lt1QvfXAHrdM5glMi8eB' where id = '925cc075-89dd-530a-8fc5-8efbca0b73fb'; -- [ID 4129] Pic lab midterm
update public.materials set drive_link = 'https://drive.google.com/drive/folders/1XIz_3QY3DLbCqY44tPEXLu5SKe0HDseN' where id = '05ca9a9b-702a-5c2c-97f6-23c28d1bda90'; -- [ID 4128] Quiz
update public.materials set drive_link = 'https://drive.google.com/drive/folders/1fO0A_OrmegvD3S2FeN_HwrCm3ofAoYce' where id = '9da2e709-2f9a-5a6f-b4ac-5755788408dc'; -- [ID 4130] final
update public.materials set drive_link = 'https://drive.google.com/drive/folders/1h2cvg9VrGw_eeZ_NZJoknQ7e9SMNfXIE' where id = '26b64b5a-931e-5a56-8299-cc605cf67765'; -- [ID 4582] project #1
update public.materials set drive_link = 'https://drive.google.com/drive/folders/1BtgwdM34Dzl0Pi6ZADLr4xu1UTb4E-QZ' where id = '2155d867-3831-566c-81e5-c6884fe017c2'; -- [ID 4583] project #2
update public.materials set drive_link = 'https://drive.google.com/drive/folders/10q14W5SRCZ369AmEsSJSKUo4ZSfFJo8L' where id = '9f47b5ec-4362-5ac7-81b0-91c823be7411'; -- [ID 4584] project #3
update public.materials set drive_link = 'https://drive.google.com/drive/folders/1tse9ybVwetFZ8s30byIpRVw7tcT6tZo8' where id = '87bc5ae0-af27-5051-b2bb-e9b22e0f1065'; -- [ID 4127] traffic light system assignment
update public.materials set drive_link = 'https://drive.google.com/drive/folders/1u_JFBTZGDsz0W20SJUVIHZC4rEohD_Ee' where id = 'b6c8d5af-59d4-5cd3-9b08-05d376789f51'; -- [ID 4263] باقي الواجبات
update public.materials set drive_link = 'https://drive.google.com/drive/folders/1ohyrrstlbWfmuI9ZWCIWQ9mYXXuKJHQr' where id = 'dbb2cdd7-42d5-50a6-b19a-c1cae2318571'; -- [ID 4262] بعض حلول الواجبات و التمارين
update public.materials set drive_link = 'https://drive.google.com/drive/folders/18yDcjohs-8x-fsae-RweR04OzE8vujrt' where id = 'e5a788e1-75c8-55b6-85cd-3f2dc27aa597'; -- [ID 4261] مشروع المادة
update public.materials set drive_link = 'https://drive.google.com/drive/folders/1xFvSsQr-G9PLD_JN6c73Y7D5LbvKI6I9' where id = '77437da3-3739-5ed5-a0a1-35b3d6222b7c'; -- [ID 2105] تلخيص مختبر تطبيقات أنظمة التشغيل 2022
update public.materials set drive_link = 'https://drive.google.com/drive/folders/1jLUzFWFyWUZQRUbdtPhCr5PBiIRHVn-R' where id = '7d6e7270-792d-5ddb-8a57-1a199dee0a91'; -- [ID 5419] تقارير في مختبر فيزياء 1
update public.materials set drive_link = 'https://drive.google.com/drive/folders/1oRYSPXx287uzThUosSAKK9KEvATgOytd' where id = 'c117e5a8-43b7-5cae-b12a-0bda81e0fd6d'; -- [ID 4948] تقارير مختبر فيزياء 1 من الطالبة سدين ايهاب الدودة من تخصص هندسة المساحة
update public.materials set drive_link = 'https://drive.google.com/drive/folders/1X0ULASTyoM1sfHrQ3WBrjCklNE61PKyh' where id = '4b2bcc17-8cae-5a2e-b0ba-4c811e868745'; -- [ID 4132] all catia homeworks
update public.materials set drive_link = 'https://drive.google.com/drive/folders/10M5NdTwxuzj12lDfYR46siXNm54PH-wb' where id = 'db224517-e51a-5ce7-b086-6a12b6e6586b'; -- [ID 4636] دورة صيانة الاجهزة الالكترونية الصناعية.
update public.materials set drive_link = 'https://drive.google.com/drive/folders/17jBTl6x4kLMGTXzWN5DI0y3nb3tUeFsr' where id = 'd03a5f35-e9bb-513d-b81d-75db18ca995c'; -- [ID 3700] محاضرة مسجلة تخصص المستحضرات
update public.materials set drive_link = 'https://drive.google.com/drive/folders/1RK_M8jhoDEW5ijUTy5AkNrcQqsDEe_jA' where id = '24d27e14-44d2-5bfc-b12b-c207b7bd5b74'; -- [ID 1564] دفتر معادلات تفاضلية
update public.materials set drive_link = 'https://drive.google.com/drive/folders/1OGC38AjZQSdNYVfa7RKwe9dR4fI5JC6H' where id = '43a1b2d2-689a-5146-8654-ce4f348ee015'; -- [ID 4142] all slides
update public.materials set drive_link = 'https://drive.google.com/drive/folders/11_hm7qYWo7zXEQVUEIuqbVz18YrewaOH' where id = '467b6276-9cee-5561-ac53-68bed3015d80'; -- [ID 4120] image stitching assignments final project
update public.materials set drive_link = 'https://drive.google.com/drive/folders/1kTbd6XViirNC0nfvkrGSoQPVEPD0t0tj' where id = '8d64b979-1ba4-584f-bb8d-bf454e58635d'; -- [ID 4119] programming assignment solution
update public.materials set drive_link = 'https://drive.google.com/drive/folders/12zaKHpcFjev6SaOpPVuFvb3Q-JHqAo5k' where id = '783ecc50-e75f-5c5d-98a4-a5bbd7f19670'; -- [ID 209] تلخيص شابتر ١+٢
update public.materials set drive_link = 'https://drive.google.com/drive/folders/1aVgg_wad97EcK01kRozpnV4IOTjTVx1h' where id = 'aa64abed-7349-563a-8bf3-c7929aaa48c6'; -- [ID 1148] Notebook of probability Theory for first semester of 2021/2022
update public.materials set drive_link = 'https://drive.google.com/drive/folders/1AWsTa9Y27fiwTWTpgZmpl1-HxEVzGl9r' where id = '84cf5682-fbb1-576b-9ac7-76b29dec5958'; -- [ID 1567] دفتر نظرية الاحتمالات
update public.materials set drive_link = 'https://drive.google.com/drive/folders/13x7RERSFd11makh5KhyEzHkCfgJJJMnS' where id = '4997ca8f-fed8-5a5f-877b-e2412e742a55'; -- [ID 3290] مشروع المساق

-- 3) حذف السجلات التي لا تملك ملفات متاحة (روابط خارجية مقفلة بـ 'يجب طلب الإذن بالوصول' أو محذوفة 404 أو مجلدات فارغة)
delete from public.materials where id in (
  '21308419-2e23-5574-8644-c98f12da5d93', -- [ID 8] تلخيص خوارزميات (لا يوجد ملف قابل للتنزيل)
  '2601e73a-3b7f-576c-af59-f182d8028ff7', -- [ID 3162] Final (لا يوجد ملف قابل للتنزيل)
  '4032f0d7-2c43-5084-b279-2974b89af07c', -- [ID 479] Final (لا يوجد ملف قابل للتنزيل)
  'db0456a9-c9fb-5e99-92fb-3a8658b7e4a8', -- [ID 492] Final (لا يوجد ملف قابل للتنزيل)
  'a0ede4b8-cb9e-587f-aac2-51fba94adfe1', -- [ID 493] Quizzes (لا يوجد ملف قابل للتنزيل)
  'b23da73d-8d20-50bf-8424-834c0e9efec9', -- [ID 5211] امتحان نصفي ونهائي (لا يوجد ملف قابل للتنزيل)
  'b586419b-40cc-5b19-b80f-c738530f5150', -- [ID 488] Final (لا يوجد ملف قابل للتنزيل)
  'fe67fdb8-28ea-5dbb-8d3a-9a079e2c5788', -- [ID 489] Midterm (لا يوجد ملف قابل للتنزيل)
  'f081b44c-b65d-5235-bcc0-2e9ee499a72b', -- [ID 490] Quizzes (لا يوجد ملف قابل للتنزيل)
  '9978c661-c372-573d-84a8-982de5baf57c', -- [ID 486] Final (لا يوجد ملف قابل للتنزيل)
  'ec0a0d90-af39-57c8-b363-5cdc9c1d450e', -- [ID 487] Quizzes (لا يوجد ملف قابل للتنزيل)
  '196041e5-303c-5044-a442-d90a943882f7', -- [ID 491] Quizzes (لا يوجد ملف قابل للتنزيل)
  'da732f5c-e906-572f-87e5-cb7f57618396', -- [ID 481] Final (لا يوجد ملف قابل للتنزيل)
  '108b4ea1-3d4c-5184-bf01-4e1a75935363', -- [ID 482] Midterm (لا يوجد ملف قابل للتنزيل)
  '2857bb65-0dbf-5a97-bf73-36105a0c2ed7', -- [ID 483] Quizzes (لا يوجد ملف قابل للتنزيل)
  'd1cf6e3b-3847-59ef-b226-f6ce6ded482d', -- [ID 480] امتحان (لا يوجد ملف قابل للتنزيل)
  '2880d7e0-3e85-55fd-b011-d6ca2b8c0c55', -- [ID 484] امتحانات (لا يوجد ملف قابل للتنزيل)
  '76276d54-1417-5235-8e9e-0813cdc98418', -- [ID 485] امتحان (لا يوجد ملف قابل للتنزيل)
  '2f655bcc-f4df-5402-acc4-57f32a7ecd45', -- [ID 5422] كل ما يخص الكالكولس2 (لا يوجد ملف قابل للتنزيل)
  'aa8792f8-aff5-5866-8460-c1833d0dd57c', -- [ID 5428] كل شيئ يخص أساسيات البرمجة (لا يوجد ملف قابل للتنزيل)
  '1a04bfab-f29c-54c6-bed5-d39b2979326c', -- [ID 5423] كل ما يخص الفيزياء (لا يوجد ملف قابل للتنزيل)
  'a7afbbc6-3521-56aa-b113-6c99967547e7', -- [ID 5424] كل ما يخص الورشة الهندسية (0700102) (لا يوجد ملف قابل للتنزيل)
  '044278ae-8d60-5308-b472-3efad98f9869', -- [ID 970] تلخيصات أساليب البحث العلمي (لا يوجد ملف قابل للتنزيل)
  'e4a301eb-af81-5744-a331-9f5f0d8f4204', -- [ID 3848] online quizzes for cyber security (لا يوجد ملف قابل للتنزيل)
  '3c075808-2477-5dc1-acd2-7045ec2e04fc', -- [ID 3861] أمن سيبراني (لا يوجد ملف قابل للتنزيل)
  'f8eaa6cd-3eb3-5c2a-9db8-e13f9478cb45', -- [ID 2610] حلول مختبر البرمجه المرئية (لا يوجد ملف قابل للتنزيل)
  'f19fb483-ff98-5bf0-b8cd-e6ab03c020a2', -- [ID 3671] تلخيصات تشريح طب٢ ظهر واطراف وحوض... وسلايدات مشروح عليها (لا يوجد ملف قابل للتنزيل)
  'bc20980b-8076-5959-a994-6015d0981fd7', -- [ID 2879] Spectroscopy (لا يوجد ملف قابل للتنزيل)
  'b40fd14e-b47f-5ad0-b6d5-cfdbe5a7af44', -- [ID 3012] Midterm Lab (لا يوجد ملف قابل للتنزيل)
  'f7be8bf2-332a-58ea-9eaa-3b9cbf9d0a73', -- [ID 1652] Apex Tutorial: Very helpful tutorial (لا يوجد ملف قابل للتنزيل)
  'a81eeb63-23a0-5019-9059-b95d5da1bb43', -- [ID 1653] Explanation in Arabic for Apex (لا يوجد ملف قابل للتنزيل)
  '5eb41146-657a-553e-8baa-1a50380ca2e1', -- [ID 1651] Slides Of DBP Course (لا يوجد ملف قابل للتنزيل)
  '51eb7e3e-aefa-5528-9e03-6688523ddf9f', -- [ID 3001] ملف التنزيل الخاص ب Oracle من نفس سيرفر الجامعة (لا يوجد ملف قابل للتنزيل)
  'd7e4761a-adf9-5c43-9149-0b3dc58066de', -- [ID 1170] The entire course material (تعذر تنزيل الملف: HTTP 500)
  '2e5af7e7-e6f6-538c-a977-b65d924ff2fd', -- [ID 1090] A link to everything related to numerical analysis, the book and its solution, exams, summaries, lectures, laboratory project, assignments. (تعذر تنزيل الملف: HTTP 404)
  'e8d1f780-d939-52bf-a961-120ff58ef8a0', -- [ID 673] Exercises of ch 13 & it's solution (لا يوجد ملف قابل للتنزيل)
  '0849719d-6b2c-56ef-95dd-c6dc05690124', -- [ID 672] Solution of ch 12  from section 1 to section 4 (لا يوجد ملف قابل للتنزيل)
  'f85a36d5-4357-5299-915e-9688c0a894ec', -- [ID 2233] entrance 2023 (لا يوجد ملف قابل للتنزيل)
  'c1f637ad-8f6a-5620-8a25-550ef447c5ff', -- [ID 3550] المشروع النهائي للمساق (لا يوجد ملف قابل للتنزيل)
  '8a8239c6-3cd1-5685-8005-900e732e12c8', -- [ID 2264] سلايدات المادة كاملة لسنة 2022 (لا يوجد ملف قابل للتنزيل)
  'df419dc9-e8b0-50ba-8e62-1b91c471fea4', -- [ID 2891] Medical imaging (لا يوجد ملف قابل للتنزيل)
  'd1ea7ad9-2335-550b-a426-dc5b68809c6a', -- [ID 2893] Solid state physics (لا يوجد ملف قابل للتنزيل)
  '23793e69-8a90-5f37-9d9d-aade7eeb9f42', -- [ID 2889]  (لا يوجد ملف قابل للتنزيل)
  '06db700a-e111-5417-943f-f5f2592e305b', -- [ID 2888] فيزياء حرارية (لا يوجد ملف قابل للتنزيل)
  '0bd2e8f0-c2a8-5336-a25a-0236bf08eabb', -- [ID 675] Important summary and explanation (لا يوجد ملف قابل للتنزيل)
  '1a03697d-c33c-576e-b52b-13c8e093131a', -- [ID 2900] Mathematical methods in physics (تعذر تنزيل الملف: HTTP 404)
  '166c6a42-5ef8-5e19-b4a3-acd7bb369c2e', -- [ID 5239] تلخيص ch1+2+3+4+5 (لا يوجد ملف قابل للتنزيل)
  'cf8c9d27-0800-5bda-811f-91e87cc59a7f', -- [ID 2880]  (لا يوجد ملف قابل للتنزيل)
  '69a55cf0-3a5e-5ff2-9d1e-96e187e50906', -- [ID 2877] تلخيصات كهروديناميكية (لا يوجد ملف قابل للتنزيل)
  '96a10acc-a11d-5b09-adf2-4876efe83c0d', -- [ID 678] Summary of ch1 &ch2 (لا يوجد ملف قابل للتنزيل)
  '40025c41-ae16-507a-932a-543fd997b701', -- [ID 4301] HW3 (تعذر تنزيل الملف: not a binary document or inaccessible public link)
  '7f99625f-f80d-57ec-b108-d71de7df7d43', -- [ID 2387] Quize in chapter 1 (لا يوجد ملف قابل للتنزيل)
  '2ffa469d-5df3-5d1e-9062-877347a14ea1', -- [ID 2234] slides 10th edition (لا يوجد ملف قابل للتنزيل)
  '11960a63-8d42-5f85-9314-88cf83076636', -- [ID 2876] Applied physics lab 1 (لا يوجد ملف قابل للتنزيل)
  '54a0f5d8-a34b-5c47-b995-2e38f27b2283', -- [ID 2875] Reports (لا يوجد ملف قابل للتنزيل)
  'b3b512b9-47e5-5d1a-b150-3382337ffd15', -- [ID 4501] تقارير مختبر فيزياء تطبيقية (لا يوجد ملف قابل للتنزيل)
  '561f7ee5-6267-5dbb-b3ab-4f2459c36385', -- [ID 2882] Applied physics lab 2 (لا يوجد ملف قابل للتنزيل)
  '93edce08-a83c-52a9-9d12-931c5807e402', -- [ID 2884] Matlab (لا يوجد ملف قابل للتنزيل)
  '2b797464-cbb7-5c78-b158-3dde264e7e14', -- [ID 2883] تقارير (لا يوجد ملف قابل للتنزيل)
  '8c51a797-eae6-5c44-9c00-b794d1b2a698', -- [ID 1814] First (تعذر تنزيل الملف: HTTP 404)
  'f085d0ad-1616-5f84-a135-5a568cb9d676', -- [ID 2881]  (لا يوجد ملف قابل للتنزيل)
  '574973d6-a06c-5609-a74a-da1df1b7dd04', -- [ID 2901] Quantum mechanics (تعذر تنزيل الملف: HTTP 404)
  '23250802-c308-5ef9-9792-3a051d667ef3', -- [ID 2878] تلخيص ميكانيكا الكم ١ (لا يوجد ملف قابل للتنزيل)
  '9718aa09-baf2-5c09-a05f-6ee4a2e2fe85', -- [ID 2886]  (لا يوجد ملف قابل للتنزيل)
  '1513023e-ad89-5b40-b7e0-facabba06848', -- [ID 2885] ميكانيكا الكم ٢ (لا يوجد ملف قابل للتنزيل)
  '062fb6ea-d6c1-5cd5-863a-e578aa3c268e', -- [ID 687] General summary (لا يوجد ملف قابل للتنزيل)
  'c1127c60-1b1b-5f0f-a866-38e3d9152f00', -- [ID 679] Summary of ch1 &ch2 (لا يوجد ملف قابل للتنزيل)
  'a257a983-029f-53cc-9c11-83ad53a260bb', -- [ID 3563] سلايدات نظرية الحوسبة (لا يوجد ملف قابل للتنزيل)
  '2bc108ee-0d12-58de-becd-efcbc9b70574', -- [ID 2021] دفتر هندسة اقليدية ولا اقليدية (تعذر تنزيل الملف: HTTP 404)
  '53caa184-5b0e-5fbe-b2c4-6c23e570d4ac', -- [ID 906] First (تعذر تنزيل الملف: not a binary document or inaccessible public link)
  '2efa636a-6f42-530b-a882-8d86dd68a267', -- [ID 5028] تلخيص لمادة أخلاقيات الحاسوب ، للطالب حازم عمايرة (لا يوجد ملف قابل للتنزيل)
  '33168a2f-c95a-5817-ab1d-cb735b013765', -- [ID 5616] أنظمة الحوسبة السحابية (لا يوجد ملف قابل للتنزيل)
  '56c87206-eaa6-5bca-aaec-8d90e5d59fd1', -- [ID 5897] Final Big Project 2026 with Solution (تعذر تنزيل الملف: not a binary document or inaccessible public link)
  'e8865e0c-b3d5-50d2-8753-a1a7b13aeed9', -- [ID 5896] HW1 2026 Solution (تعذر تنزيل الملف: not a binary document or inaccessible public link)
  '786be50e-c557-5a7e-b867-82d7431363d5', -- [ID 5895] HW2 2026 Solution (تعذر تنزيل الملف: not a binary document or inaccessible public link)
  '227b9b1e-c1d0-58eb-93e7-7f9f566c48e8', -- [ID 5518] مشروع المادة (لا يوجد ملف قابل للتنزيل)
  'd14bf53b-5130-5da0-8192-8c94f57efdbd', -- [ID 5764] إدارة واقتصاد (لا يوجد ملف قابل للتنزيل)
  '9e9aa71b-5f1a-5b3e-bfd9-e042a3f089e7', -- [ID 1798] Scientific Research Project (لا يوجد ملف قابل للتنزيل)
  '9b4737df-574e-504c-9a5f-a4cff42a1f37', -- [ID 5765] أساليب البحث العلمي (لا يوجد ملف قابل للتنزيل)
  'a63757bd-70f0-58f2-b32b-565b1896d3f6', -- [ID 2328] تجميعات احياء عامة 1 (طلاب طب) (لا يوجد ملف قابل للتنزيل)
  '3df4dbf6-3725-51e5-a2ce-909f3287f6fe', -- [ID 3178] Final (لا يوجد ملف قابل للتنزيل)
  'd7ee78a2-7f2d-5e3e-9876-65d9e490bc25', -- [ID 1997] Chapters (لا يوجد ملف قابل للتنزيل)
  '9b444e31-b1f7-5fae-a3be-4db42a6b4e5c', -- [ID 903] First (لا يوجد ملف قابل للتنزيل)
  '414a777d-ea1b-5c14-b028-487db221ecb0', -- [ID 1812] Second (لا يوجد ملف قابل للتنزيل)
  'd541371a-945a-5712-9fe8-03ecda84dbc1', -- [ID 3858] احتمالات وإحصاء (لا يوجد ملف قابل للتنزيل)
  '358f6547-126f-570e-99b9-b398911cd4aa', -- [ID 29] سنوات سابقة احتمالات واحصاء (لا يوجد ملف قابل للتنزيل)
  '3436d5a7-107b-57e3-b018-7758770cb256', -- [ID 3720] قناة شرح (أحمد حجاج ) (تعذر تنزيل الملف: not a binary document or inaccessible public link)
  'f826de3f-319e-5e4a-8592-d9c5100259e0', -- [ID 4478] Assignments (لا يوجد ملف قابل للتنزيل)
  '24a5dbca-d14c-56e0-a608-c6b205ac7073', -- [ID 4138] أسئلة واجابات (لا يوجد ملف قابل للتنزيل)
  'ea1872a3-3cec-5081-b55d-142a937f91b4', -- [ID 5090] الإشارات والأنظمة (لا يوجد ملف قابل للتنزيل)
  'c49e611e-e233-572c-b09c-bbd099188d91', -- [ID 3203] شرح يوتيوب (لا يوجد ملف قابل للتنزيل)
  'fc2cc5c8-5c79-567d-a6b0-64820144c5bf', -- [ID 1757] الالكترونيات المعاصرة (لا يوجد ملف قابل للتنزيل)
  'f798a0c0-9c08-5cc6-8f57-537214b76b9c', -- [ID 1850] تلخيص المادة كاملة (لا يوجد ملف قابل للتنزيل)
  '2801c223-52f2-511b-9b5c-f2d207e792c7', -- [ID 3355] تفريغ سلايدات اناتومي (لا يوجد ملف قابل للتنزيل)
  'be0a7ae7-ee41-5a2e-a74e-caf17f1191b0', -- [ID 3690] محاضرات مسجلة+ سلايدات || تخصص المستحضرات الطبية في التجميل (لا يوجد ملف قابل للتنزيل)
  '9f58712a-39e7-5001-8d74-2ef50706e2f7', -- [ID 4532] سلايدات المادة (لا يوجد ملف قابل للتنزيل)
  'e6bb4658-f086-571a-8df5-c5943ad8ae7c', -- [ID 2892] Particle and nuclear physics (لا يوجد ملف قابل للتنزيل)
  'be8853cf-8ccf-57cc-beeb-e8a2a34ab213', -- [ID 3696] محاضرات شرح  PowerPoint 🔸+ Excel + Org (لا يوجد ملف قابل للتنزيل)
  '20407a7a-f722-5d8a-9c1c-8da96dcb2abd', -- [ID 2204] امتحانات (لا يوجد ملف قابل للتنزيل)
  '03376e5e-e511-5128-bcf6-a7b9ec5ca14f', -- [ID 3165] مشروع حوسبة متوازية (لا يوجد ملف قابل للتنزيل)
  'ce6ac664-7eef-5903-9a0f-f0feb40e1423', -- [ID 3499] ريادة (لا يوجد ملف قابل للتنزيل)
  'a7cb8f76-8218-5c43-aa81-2bfcbea4e9c7', -- [ID 901] First (لا يوجد ملف قابل للتنزيل)
  '513e0deb-ec46-592a-9e0e-314e509c8b46', -- [ID 1298] سلايدات شبكات لاسلكية وسريعة (لا يوجد ملف قابل للتنزيل)
  'ff14f66c-e239-5106-bd8e-fb178598b8c0', -- [ID 2890] Computational physics (لا يوجد ملف قابل للتنزيل)
  'cd25007d-1e6b-5d28-9790-df612509a76c', -- [ID 680] تلخيص وحدة 2 الصياغات الإجرائية (لا يوجد ملف قابل للتنزيل)
  'f9908c9e-57f7-5d51-b9ed-501173b71572', -- [ID 3364] الكتاب+حلول الكتاب+السلايدات+إمتحانات فيرست وسيكند وميد مع الإجابات النموذجية+فيديوهات شرح الدكتور+تلخيص للمادة (لا يوجد ملف قابل للتنزيل)
  'a545d0b1-e804-5c1a-8416-55af90e40c64', -- [ID 697] Summary of physical electronics course (لا يوجد ملف قابل للتنزيل)
  '30424dbb-ad8d-5454-9741-b7e3387f4dc7', -- [ID 894] تلخيصات الكترونيات فيزيائية (لا يوجد ملف قابل للتنزيل)
  'd5c31214-22f2-589e-a130-7bbeca716e4f', -- [ID 2980] الكتاب+حلول الكتاب+إمتحانات فيرست وسيكند وميد وفاينل مع الإجابات النموذجية+فيديوهات شرح+تلخيص للمادة (لا يوجد ملف قابل للتنزيل)
  'b7ce6e93-ae99-5422-95f6-a4429813ed43', -- [ID 3689] عروض بوربوينت و فيديوهات مسجلة شرح من شابتر 5_14 (لا يوجد ملف قابل للتنزيل)
  '4f5fb467-f741-58a6-a0a8-313f3d8e34bb', -- [ID 3349] Final (لا يوجد ملف قابل للتنزيل)
  '77559a7c-9d7d-57ae-b0dc-34019d639aed', -- [ID 5712] Microcontroller HW solutions (لا يوجد ملف قابل للتنزيل)
  '25b80d8b-a9ff-519f-9c6b-2a5fcea51f78', -- [ID 4239] تقارير مساحة 1 عملي للطالبة سدين إيهاب يونس (تعذر تنزيل الملف: not a binary document or inaccessible public link)
  'cd78f79b-d1e8-5b55-955d-6de243a96159', -- [ID 3824] Course Project (لا يوجد ملف قابل للتنزيل)
  'f05b6597-19b8-5f79-9964-7107396dadc6', -- [ID 5130] المعالج الدقيق وربط الأنظمة (لا يوجد ملف قابل للتنزيل)
  'ce84134c-866f-5c89-b723-5c0744298eaf', -- [ID 5549] المعالجات المتقدمة (لا يوجد ملف قابل للتنزيل)
  '425a67d3-8599-5585-a0e7-555f60421e35', -- [ID 5036] سلايدات المادة كاملة (RISC-V, ARM, Special Processors) (لا يوجد ملف قابل للتنزيل)
  '1ecde832-43b1-5a55-be4d-93cfb58a81d1', -- [ID 18] سلايدات منطق رقمي (لا يوجد ملف قابل للتنزيل)
  'ac089937-5ecc-5506-9e86-c08c67f0dfbf', -- [ID 19] سنوات سابقة منطق رقمي (لا يوجد ملف قابل للتنزيل)
  '00e342c4-6790-5135-903a-ff6bdcb066ae', -- [ID 3702] نماذج من مشاريع منطق رقمي 1 (لا يوجد ملف قابل للتنزيل)
  '05e7945f-2503-53f2-9c23-cff551f77a02', -- [ID 5404] تسجيلات شرح للمادة (لا يوجد ملف قابل للتنزيل)
  'fcaf9309-30a8-55e4-9afa-0e27e57ca574', -- [ID 5810] حل نماذج الامتحانات السابقة +HW2 (مادة ال second) (تعذر تنزيل الملف: not a binary document or inaccessible public link)
  'beceee0c-4e36-5988-b15e-09fb7986f886', -- [ID 900] First (لا يوجد ملف قابل للتنزيل)
  'ce7e81f4-0313-53cd-bada-e0408b6216ce', -- [ID 1329] Midterm+Final مختبر (لا يوجد ملف قابل للتنزيل)
  '1fa8176c-dead-558e-92fd-61e947bbc760', -- [ID 23] OOP LAB (سلايدات مختبر الجافا) (لا يوجد ملف قابل للتنزيل)
  '6539e84e-9683-5900-9a7d-ab3ae52ddbfa', -- [ID 3517] Project OOP (لا يوجد ملف قابل للتنزيل)
  '2b4203e0-b6e3-5583-a580-5fe76b5c686e', -- [ID 24] امتحانات مختبر الجافا (لا يوجد ملف قابل للتنزيل)
  '5a895dd3-a716-574b-8f48-d85bc9566adb', -- [ID 27] تلخيص برمجة كيانات (لا يوجد ملف قابل للتنزيل)
  '643e6d9c-24e9-5dc4-970d-1e6d8cc90e72', -- [ID 1753] تلخيص برمجة كيانات (لا يوجد ملف قابل للتنزيل)
  '46b1316c-b894-5238-b3fd-5cac7f0abd71', -- [ID 1779] حلول اسئلة مختبر برمجة الكيانات (لا يوجد ملف قابل للتنزيل)
  '0f6fee03-684f-5135-b45a-1be63f7944ad', -- [ID 4137] سلايدات المساق (لا يوجد ملف قابل للتنزيل)
  '6b0f7b53-7ec8-5276-b36c-6f643433f778', -- [ID 1754] سلايدات برمجة كيانات (لا يوجد ملف قابل للتنزيل)
  '6a0b8e4a-7697-5677-bb18-33749e91ab42', -- [ID 5487] سلايدات لجميع المادة وبعض التسجيلات لمحاضرات (لا يوجد ملف قابل للتنزيل)
  '0c192e7b-ef40-5f17-b26e-56d0454ff4bc', -- [ID 28] سنوات سابقة برمجة كيانات (لا يوجد ملف قابل للتنزيل)
  'ad10286e-29f3-5f09-b43f-bb6d714cc246', -- [ID 4535] SP Material for all chapters (لا يوجد ملف قابل للتنزيل)
  '01d6426b-430d-52f0-8b35-3cc5166b7566', -- [ID 4319] final project (لا يوجد ملف قابل للتنزيل)
  'cdbd6ea5-a4fd-5d47-8cef-912c57b0ec4f', -- [ID 5619] برمجة النظم (لا يوجد ملف قابل للتنزيل)
  '47205ac9-bcc2-59a6-8986-0a50bc1a78e9', -- [ID 676] Summary of optics (لا يوجد ملف قابل للتنزيل)
  '567efb55-f385-5cf2-90c9-e117052db0a7', -- [ID 982] Summarys for all lectures (لا يوجد ملف قابل للتنزيل)
  '08d4cee9-ed00-5134-8a45-004c345d2986', -- [ID 1] تلخيص تاريخ (لا يوجد ملف قابل للتنزيل)
  '9a29d52b-d7c5-503b-a72b-026fcf00dd6e', -- [ID 14] سنوات سابقة تاريخ (لا يوجد ملف قابل للتنزيل)
  'd8e75df8-d9a9-5436-8b32-abbdd9491453', -- [ID 4272] الكتاب+حل الكتاب+سنوات+مشاريع (لا يوجد ملف قابل للتنزيل)
  '4a1e206a-6640-5867-a75c-19dafe1cd27a', -- [ID 4759] ملاحطة: يجب عليك استخدام إيميلك الجامعي لفتح الرابط (لا يوجد ملف قابل للتنزيل)
  'bdaaf13f-3b4d-55de-a1a4-77718fc84d05', -- [ID 1088] A link to everything related to numerical analysis, the book and its solution, exams, summaries, lectures, laboratory project, assignments. (تعذر تنزيل الملف: HTTP 404)
  '7cccf0e7-2b9a-5e5f-a591-919356573627', -- [ID 1089] A link to everything related to numerical analysis, the book and its solution, exams, summaries, lectures, laboratory project, assignments. (تعذر تنزيل الملف: HTTP 404)
  '3481d490-269d-534a-a6f8-b33ddb7717e7', -- [ID 1795] Numerical Systems Analysis (لا يوجد ملف قابل للتنزيل)
  'd14b1bb1-3af0-5091-b4f1-2f030e300ceb', -- [ID 5463] تجميع ملخصات لجميع المادة وامتحانات فاينل الكتروني ووجاهي (لا يوجد ملف قابل للتنزيل)
  '1a2e9bf8-1d18-5953-b05b-2ec249c39af6', -- [ID 2001] مشروع المساق (لا يوجد ملف قابل للتنزيل)
  'c49ee5b2-70b6-53e8-9df8-8deae07bd346', -- [ID 4680] Student Solutions Manual1 (تعذر تنزيل الملف: not a binary document or inaccessible public link)
  '3aa5eae7-0962-51ba-877e-4cc7f2b01896', -- [ID 4681] student solution manual 2 (تعذر تنزيل الملف: not a binary document or inaccessible public link)
  '5fdbee41-e7e5-5291-81f5-91447f00824c', -- [ID 3706] Slides - Data Structures - Zein Salah (لا يوجد ملف قابل للتنزيل)
  '721fd120-2968-5217-9847-4f07203cc142', -- [ID 4284] كتاب+حلول الكتاب+سنوات+مشاريع (لا يوجد ملف قابل للتنزيل)
  '63334ac2-5d48-50ea-9c72-92eabf5d6ead', -- [ID 904] First (تعذر تنزيل الملف: not a binary document or inaccessible public link)
  'ff8ffc2f-82d9-5be0-b6ff-d02f221daaf0', -- [ID 905] Second (تعذر تنزيل الملف: not a binary document or inaccessible public link)
  '226eed91-cf83-5137-ab8c-3d088ef849a3', -- [ID 2919] أكواد متنوعة (لا يوجد ملف قابل للتنزيل)
  '286fa72d-5c9c-5ccf-aaa5-7559471122d5', -- [ID 3859] تصميم أنظمة رقمية (لا يوجد ملف قابل للتنزيل)
  'ff3e812c-e6fe-5664-b818-32fa2765092e', -- [ID 4421] ملاحطة: يجب عليك استخدام إيميلك الجامعي لفتح الرابط (لا يوجد ملف قابل للتنزيل)
  'ae818fae-8923-5c25-b079-6ea701818ce6', -- [ID 910] ٍShort First Exam (تعذر تنزيل الملف: not a binary document or inaccessible public link)
  '5782b315-2177-5423-ae47-2f88c93f53e3', -- [ID 5249] سلايدلت+ كتاب + سنوات سابقة (لا يوجد ملف قابل للتنزيل)
  'fb111997-7386-532e-a125-91d7d9e534b3', -- [ID 3514] Algorithm Project (لا يوجد ملف قابل للتنزيل)
  'd14e1ace-0c20-5970-b2eb-0f0dbf3b4167', -- [ID 1794] Algorithms Project (لا يوجد ملف قابل للتنزيل)
  '514e1d98-c0b1-51e6-a863-dfe3531c5c20', -- [ID 1731] Introduction to the Design and Analysis of Algorithms 3rd Edition (لا يوجد ملف قابل للتنزيل)
  '0e4536d2-b0ad-597f-9ce3-47f4b622817a', -- [ID 1942] Quizzes 2(في شابتر 8 graphs) (لا يوجد ملف قابل للتنزيل)
  '86f268cc-1675-5462-84e6-650b68485ff3', -- [ID 1804] Quizzes مع الاجابات النموذجية (لا يوجد ملف قابل للتنزيل)
  '726e8f8f-fe4c-5b1f-a512-7b9710b85d20', -- [ID 1827] المراجع المستخدمة في شرح تصميم وتحليل الخوارزميات (لا يوجد ملف قابل للتنزيل)
  '6c763306-3f5b-52e2-acef-0da377a1e410', -- [ID 4486] تصميم وتحليل الخوارزميات (لا يوجد ملف قابل للتنزيل)
  'e1fa060a-0b21-5ca4-a2de-ae3051a2697c', -- [ID 10] تلخيص خوارزميات 3 (لا يوجد ملف قابل للتنزيل)
  'e52d54ea-d073-58f5-9ed5-79bde945b61b', -- [ID 9] تلخيص خوارزميات سيكند (لا يوجد ملف قابل للتنزيل)
  '8b458dc6-2082-5af0-bac5-cc47eca32a67', -- [ID 3436] سلايدات تصميم وتحليل خوارزميات (لا يوجد ملف قابل للتنزيل)
  '2795d6c1-06e4-5304-8a40-dda32c061a3b', -- [ID 11] سنوات سابقة خوارزميات (لا يوجد ملف قابل للتنزيل)
  '347689ca-ce71-5a42-9e09-87b770f5a5b4', -- [ID 5482] مجموعة امتحانات فيرست وسيكند وميد وفاينل وكويزات مع الحلول (لا يوجد ملف قابل للتنزيل)
  '3a7eff87-4c01-51ec-8820-228ee6667121', -- [ID 12] واجبات خوارزميات (لا يوجد ملف قابل للتنزيل)
  'f569805c-7ef6-58c1-91e7-e8d191c1ba27', -- [ID 4487] تصميم وعمارة الحاسوب (لا يوجد ملف قابل للتنزيل)
  '9ff4a2bd-b118-5d3d-aef8-e50a627f22d1', -- [ID 4270] محاضرات مسجلة للمادة لعام 2023 (لا يوجد ملف قابل للتنزيل)
  '5466dc8f-bffb-5a59-928f-c4cb914b3430', -- [ID 3987] Course Slides (لا يوجد ملف قابل للتنزيل)
  '9177abe3-3aa0-5629-98ad-ebd65d47dbd1', -- [ID 30] تلخيص تعلم الة (لا يوجد ملف قابل للتنزيل)
  'f79c5941-cda5-512d-b42a-3716ea9cfb55', -- [ID 1077] كتاب Calculus 1 + 2 (تعذر تنزيل الملف: HTTP 404)
  'c79b2472-1e92-5f4e-b1d4-66a9359ec1b3', -- [ID 899] First (لا يوجد ملف قابل للتنزيل)
  'aa914342-4077-5ca1-93ab-74c0ad13b624', -- [ID 1078] كتاب Calculus 1 + 2 (تعذر تنزيل الملف: HTTP 404)
  'fb0941c6-fdd7-57f9-b814-70f4435ddc2d', -- [ID 909] Second (تعذر تنزيل الملف: not a binary document or inaccessible public link)
  '1f34e4f4-634e-5065-b911-9aabc15f2f35', -- [ID 3860] تنظيم وعمارة الحاسوب (لا يوجد ملف قابل للتنزيل)
  '5b3c52f5-3219-5215-a266-385001e0f594', -- [ID 1785] سلايدات تنظيم وعمارة الحاسوب 2022 (لا يوجد ملف قابل للتنزيل)
  '5239ac6c-e454-5b8d-92d8-249c85f638ee', -- [ID 5469] سلايدات للمادة وملخصات (لا يوجد ملف قابل للتنزيل)
  '0bba3371-1ffc-5d63-a412-de6ed0d5187e', -- [ID 163] فيرست (لا يوجد ملف قابل للتنزيل)
  '71fb9776-a8e1-5c4b-abad-a3a0a5ec21d3', -- [ID 4423] ملاحطة: يجب عليك استخدام إيميلك الجامعي لفتح الرابط (لا يوجد ملف قابل للتنزيل)
  '8e992df2-050a-512d-b172-ad224c997cc4', -- [ID 902] First (لا يوجد ملف قابل للتنزيل)
  'd97358df-1774-590a-b7e4-b694de2c2342', -- [ID 908] First (تعذر تنزيل الملف: not a binary document or inaccessible public link)
  '07aecb83-edd6-5e60-b1f9-64bc81d97afd', -- [ID 911] Second (تعذر تنزيل الملف: not a binary document or inaccessible public link)
  '1fddad33-0735-5f90-9856-eecbc5d9b252', -- [ID 2] تلخيص جبر (لا يوجد ملف قابل للتنزيل)
  '94f6a099-da3a-5d50-aa67-20ffdbe75357', -- [ID 3146] جبر خطي 1 (لا يوجد ملف قابل للتنزيل)
  'cbade578-269b-52e8-bfbd-184174b148b1', -- [ID 2947] شابتر 1 (تعذر تنزيل الملف: HTTP 404)
  '922fb64f-6435-54d8-bab7-b350b0f4ea70', -- [ID 2948] شابتر 2 محلول (تعذر تنزيل الملف: HTTP 404)
  'db74ce94-0418-5eb2-8e25-2097020e62bd', -- [ID 2950] شابتر 6 محلول (تعذر تنزيل الملف: HTTP 404)
  '172a863a-707d-5532-b869-8b8f16f78369', -- [ID 2949] شابتر 8 محلول (تعذر تنزيل الملف: HTTP 404)
  'b6b4b312-08a1-5412-b881-640886657eab', -- [ID 3173] فيديوهات شرح للمادة (لا يوجد ملف قابل للتنزيل)
  'd755ecc5-6146-5b92-859f-9ec805671adb', -- [ID 3] واجبات جبر خطي (لا يوجد ملف قابل للتنزيل)
  '708eb46e-bd6f-53bc-8cda-7bfa48843846', -- [ID 3144] رياضيات للمهندسين (لا يوجد ملف قابل للتنزيل)
  '48277fff-d0da-52d8-99d4-1cf444fa69c2', -- [ID 4408] HW1 (لا يوجد ملف قابل للتنزيل)
  '2804cc77-0997-5d41-b682-c34f0f9caf0c', -- [ID 4401] HW2 (لا يوجد ملف قابل للتنزيل)
  '6bbcac6e-560c-54df-a770-fe1cc0d57d81', -- [ID 3176] Midterm (لا يوجد ملف قابل للتنزيل)
  'fd3d2760-d449-5694-abb1-cd9a2e5b5767', -- [ID 3827] Part 1 (لا يوجد ملف قابل للتنزيل)
  'da8fb552-5722-5664-91b3-bf45b8e6c74a', -- [ID 3822] Projects &amp; Homeworks (لا يوجد ملف قابل للتنزيل)
  'ceb542cb-d267-5add-941d-e433b1d49620', -- [ID 3515] Socket program (لا يوجد ملف قابل للتنزيل)
  'd9490879-2fc6-5a5a-bfd3-1169e5acd441', -- [ID 4450] homework2 (لا يوجد ملف قابل للتنزيل)
  'f917ae5b-dfd9-5630-b105-7cec9c87b895', -- [ID 4750] المشروع الاول والثاني على اخر اصدار من  Packet Tracer (لا يوجد ملف قابل للتنزيل)
  'f74b82c7-f202-5455-972d-95dad9148e16', -- [ID 4488] شبكات الحاسوب (لا يوجد ملف قابل للتنزيل)
  '52e53eeb-12bf-561c-baf0-428b000cb31f', -- [ID 21] شبكات الحاسوب (لا يوجد ملف قابل للتنزيل)
  'ffde1724-1380-58b9-ac23-3e04dfcd9378', -- [ID 5561] مشروع المساق (لا يوجد ملف قابل للتنزيل)
  'a3a9645b-1bf9-5750-8db2-d733c305af49', -- [ID 4608] socket programming course project (تعذر تنزيل الملف: not a binary document or inaccessible public link)
  '07b6ff36-4362-5ae0-ad81-645f16847d12', -- [ID 2764] Final (تعذر تنزيل الملف: HTTP 404)
  'bdef908c-1837-5f70-a5d4-af2232a7e92e', -- [ID 367] Second (لا يوجد ملف قابل للتنزيل)
  'a942328d-8650-5abf-9f82-3268dfdcf2ad', -- [ID 405] أسئلة حل من سيكند سنوات سابقة (تعذر تنزيل الملف: HTTP 404)
  'f6194750-6b26-54c5-82a6-824c2b2d54f4', -- [ID 402] أسئلة حل من فيرست سنوات سابقة (تعذر تنزيل الملف: HTTP 404)
  '3ed2c845-7bc8-5846-adc9-935810ffabc1', -- [ID 406] أسئلة صح وخطأ من سنوات سابقة (تعذر تنزيل الملف: HTTP 404)
  '1e5573be-a9ed-5010-a2ce-ad85e28800d7', -- [ID 403] أسئلة صح وخطأ من فيرست سنوات سابقة (تعذر تنزيل الملف: HTTP 404)
  'edbf99c8-2018-53ea-ae2b-f2d2d01a107a', -- [ID 404] أسئلة ضع دائرة من سنوات سابقة (تعذر تنزيل الملف: HTTP 404)
  '8c925c3b-c80c-50eb-83e8-667abb0fae8d', -- [ID 407] أسئلة ضع دائرة من سنوات سابقة (تعذر تنزيل الملف: HTTP 404)
  'f28d8f95-7095-5f69-843f-f30536702532', -- [ID 401] أسئلة على شابتر 7+8 (تعذر تنزيل الملف: HTTP 404)
  '70a4f486-3026-5247-91f6-d73b8e0e7c02', -- [ID 398] شرح شابتر 2 فيزياء 1 (تعذر تنزيل الملف: HTTP 404)
  '81ec56d2-30ec-5722-b7dd-6d6ab716fd18', -- [ID 399] شرح شابتر 3 فيزياء 1 (تعذر تنزيل الملف: HTTP 404)
  'cdd95998-397d-5cf2-a2d8-0ce08836a57d', -- [ID 400] شرح شابتر 4 فيزياء 1 (تعذر تنزيل الملف: HTTP 404)
  'ec9a4f91-2848-594f-a506-eb642401aa89', -- [ID 918] مادة فيزياء 1 (فيرست وسيكند وفاينل) (لا يوجد ملف قابل للتنزيل)
  'f2dbe271-15cb-5362-a3e3-c3a6aaff27d4', -- [ID 555] Physics 2 (لا يوجد ملف قابل للتنزيل)
  '0669a75c-990a-5c58-a94c-c697e3fa212f', -- [ID 668] Summary of all course (physical 2) (لا يوجد ملف قابل للتنزيل)
  '8f0aeec3-b7f5-5d17-b2a4-04579309a8cc', -- [ID 917] مادة فيزياء 2 (فيرست وسيكند وفاينل) (لا يوجد ملف قابل للتنزيل)
  '44b1be70-0304-56b9-91c2-ae9db39681a9', -- [ID 2887] فيزياء الإشعاع (لا يوجد ملف قابل للتنزيل)
  'ec77a675-6a28-50c0-b363-9aa8b9653df6', -- [ID 893] Modern physics (لا يوجد ملف قابل للتنزيل)
  '72734447-5c35-5d8e-b531-09d6ea91ec58', -- [ID 5412] سنوات و تلخيص (تعذر تنزيل الملف: not a binary document or inaccessible public link)
  '6ebee4eb-d00c-58d8-a1d1-2e6ae2eacd6e', -- [ID 5505] المستشعرات والمشغلات (لا يوجد ملف قابل للتنزيل)
  'a0807ace-683f-5c0b-a743-bb87076a9e6d', -- [ID 135] سلايدات كيمياء عامة لطلبة الطب (لا يوجد ملف قابل للتنزيل)
  '3322005d-b15a-54e1-ae05-a4c9ccd3d527', -- [ID 5903] Past Exam collection (تعذر تنزيل الملف: not a binary document or inaccessible public link)
  'eeda7513-e835-5e67-8bbc-d58dbce19da4', -- [ID 20] سنوات سابقة لغة عبرية (لا يوجد ملف قابل للتنزيل)
  '41a40d7c-f812-5528-9586-cc28938a6f0b', -- [ID 3714] محاضرات مسجلة (لا يوجد ملف قابل للتنزيل)
  'c076a82d-c67b-5de0-8046-e79ae229b79e', -- [ID 3558] محاضرات مسجلة لمساق اللغة العربية (لا يوجد ملف قابل للتنزيل)
  '99066d7c-69db-55da-8c77-4cfd66f62fbf', -- [ID 1752] Latitudes (لا يوجد ملف قابل للتنزيل)
  '0ee788ad-048e-507d-9ead-8c1ef039229c', -- [ID 4354] سلايدات مع ملاحظات (لا يوجد ملف قابل للتنزيل)
  'acc840ec-a056-5163-ab4a-a65144df5319', -- [ID 4241] تقارير مختبر أحياء (لا يوجد ملف قابل للتنزيل)
  '5bd187e4-2661-5467-b8c0-675d5e188ac9', -- [ID 4498] تقارير مختبر الاكترونيات (لا يوجد ملف قابل للتنزيل)
  '333ceab7-e70b-591d-9557-60aac727ac3b', -- [ID 385] تلخيص تجارب مختبر الالكترونيات (لا يوجد ملف قابل للتنزيل)
  '2fc76bc1-a1a1-5130-9672-57e6c99eecac', -- [ID 1770] Electronic Devices Lab Reports (لا يوجد ملف قابل للتنزيل)
  '9e4742bc-d4e1-5467-909f-daeb0cf2079a', -- [ID 4] تجارب مختبر الالكترونيات (لا يوجد ملف قابل للتنزيل)
  '3a718e78-05ce-5c7e-b326-fbc55006de27', -- [ID 3926] تقارير مختبر الالكترونيات 2024 (لا يوجد ملف قابل للتنزيل)
  '6c87d14b-7ce4-543e-ba11-4bf5ef213274', -- [ID 4139] عملي باستخدام ال multisim14.3 (لا يوجد ملف قابل للتنزيل)
  '38539c4f-8c7c-5d28-9579-fc33e25bb674', -- [ID 5082] مختبر الإلكترونيات (لا يوجد ملف قابل للتنزيل)
  'e64f9f15-ffce-5f7b-98e3-bcbaa5c2dc8c', -- [ID 4497] تقارير مختبر الكترونيات فيزيائية (لا يوجد ملف قابل للتنزيل)
  'f5dab899-810d-5f0b-a723-70fc81aebd0b', -- [ID 3862] مختبر الأنظمة الرقمية (لا يوجد ملف قابل للتنزيل)
  'c3c24540-5bb6-5744-b76e-7c93f94abe5b', -- [ID 4422] ملاحطة: يجب عليك استخدام إيميلك الجامعي لفتح الرابط (لا يوجد ملف قابل للتنزيل)
  '43a56273-90e5-583c-be59-5e132119e669', -- [ID 5459] resources for more training (لا يوجد ملف قابل للتنزيل)
  '59f7ea01-c9de-5019-a94b-82f823208204', -- [ID 16] Midterm (لا يوجد ملف قابل للتنزيل)
  'a66c085c-1f58-5857-930e-9650ec6c411b', -- [ID 15] تجارب مختبر الدوائر (لا يوجد ملف قابل للتنزيل)
  'f5668710-cdf1-5e19-82a4-dd798c9fcb4c', -- [ID 3529] تقارير مختبر الدوائر الكهربائية (لا يوجد ملف قابل للتنزيل)
  '1645aa9a-223d-546e-a233-0e1e31c08808', -- [ID 3246] مختبر الدوائر الكهربائية (لا يوجد ملف قابل للتنزيل)
  'b004bf19-4bb4-551d-95d4-08ce054ad876', -- [ID 4131] محاضرات مسجلة اونلاين (لا يوجد ملف قابل للتنزيل)
  '913f73bd-2daf-57cb-be85-2bced844cc53', -- [ID 5504] مختبر المعالج الدقيق وربط الأنظمة (لا يوجد ملف قابل للتنزيل)
  '49e68cd9-9f6a-5f2b-8403-08d182c38c59', -- [ID 4294] packet tracer  files (لا يوجد ملف قابل للتنزيل)
  '0c0ca715-51f1-5d83-b201-a0561ca9e236', -- [ID 2613] Final (لا يوجد ملف قابل للتنزيل)
  'e1fabced-af93-54f6-8ea8-d247547e95b1', -- [ID 5420] تقارير مختبر فيزياء 1 (تعذر تنزيل الملف: not a binary document or inaccessible public link)
  '47b2b654-5702-592b-86de-8999c24a67f0', -- [ID 113] تقارير مختبر فيزياء 2 (لا يوجد ملف قابل للتنزيل)
  'c70f4a12-9af2-5255-8f71-4c207e397b5d', -- [ID 278] تجارب كيمياء 1 لطلبة الطب (لا يوجد ملف قابل للتنزيل)
  '4db8eb25-c775-59d0-9c3d-68767d6a90aa', -- [ID 1571] شرح المادة كاملا على قناة الدكتور جواد الزغل (لا يوجد ملف قابل للتنزيل)
  'aaac409b-c387-5097-9ed1-57fb46bc120c', -- [ID 3651] ميد تيرم نظري (لا يوجد ملف قابل للتنزيل)
  '91261268-5a62-5d0e-8223-16a15548b2af', -- [ID 674] important Explanation (لا يوجد ملف قابل للتنزيل)
  '1ef8fbf1-24df-511d-97d8-db0eaa7863c9', -- [ID 892] تلخيصات معادلات تفاضلية (لا يوجد ملف قابل للتنزيل)
  '8685f9de-4195-55fd-a146-e1bf27096f61', -- [ID 4508] دفتر المعادلات التفاضلية (لا يوجد ملف قابل للتنزيل)
  '5fb18ebe-5a23-53b8-90ca-4999508dabc2', -- [ID 205] سنوات سابقة (لا يوجد ملف قابل للتنزيل)
  '5086960b-7437-5679-b2e7-89ad330a49cb', -- [ID 7] image processing HWs (لا يوجد ملف قابل للتنزيل)
  '262b1401-e2e6-5f47-b17f-23322a931484', -- [ID 6] image processing slides (لا يوجد ملف قابل للتنزيل)
  'f1f5c637-4c56-5c43-8ba7-71fa109f5167', -- [ID 5] تلخيص معالجة الصور (لا يوجد ملف قابل للتنزيل)
  '57d96d30-e57d-598c-bf7a-392457600078', -- [ID 3289] Homework1 (لا يوجد ملف قابل للتنزيل)
  'a8e530ef-2b59-5aa0-b4dc-728911710dc1', -- [ID 3008] lab 3 (لا يوجد ملف قابل للتنزيل)
  '3e4a1776-ecb0-564f-8918-b7ebc916460f', -- [ID 3291] تسجيلات المساق (لا يوجد ملف قابل للتنزيل)
  'cc8f943a-cce1-5b04-8280-ddcdfa96797a', -- [ID 3287] مختبرات المادة + الكود (لا يوجد ملف قابل للتنزيل)
  '35f1f998-688a-5ddd-9f3f-5ba6555b6663', -- [ID 3288] مشروع المساق (لا يوجد ملف قابل للتنزيل)
  '812d67ec-dd2e-57eb-b5b9-3809f07ab417', -- [ID 5655] حلول أسئلة الواجب النهائي (تعذر تنزيل الملف: not a binary document or inaccessible public link)
  '715c19d7-5372-51fc-9951-6164577bbfb2', -- [ID 2590] Final Lab (لا يوجد ملف قابل للتنزيل)
  '899aa0c3-c04c-599a-a976-9a9aae67621a', -- [ID 2558] Midterm (لا يوجد ملف قابل للتنزيل)
  '7b011096-dbfd-5544-b705-9d9f77498b47', -- [ID 3054] Watermark project (لا يوجد ملف قابل للتنزيل)
  'cbc8b667-0ab7-54d8-82f0-40239cfb0a6e', -- [ID 3053] AES CODE (تعذر تنزيل الملف: HTTP 404)
  '902f2760-68d8-513a-8569-61d0f0f52e38', -- [ID 3056] تلخيص (لا يوجد ملف قابل للتنزيل)
  '492b120d-68cf-5cd0-be9e-4191a8134dff', -- [ID 5572] مقدمة في الأنظمة المضمنة (لا يوجد ملف قابل للتنزيل)
  '7c574cc3-8676-5927-806e-8af49e4c3f86', -- [ID 677] Important summary (لا يوجد ملف قابل للتنزيل)
  '561b256a-2559-502d-b0b2-20eab2a245df', -- [ID 4260] Bankers Algorithm Code (لا يوجد ملف قابل للتنزيل)
  '64c58eb0-590b-5d69-b9bc-eb0c47c23821', -- [ID 3055] HW (لا يوجد ملف قابل للتنزيل)
  'e036284f-595b-5c1a-8991-8731211206fb', -- [ID 3286] مشروع المساق (لا يوجد ملف قابل للتنزيل)
  '92cae3b9-757b-5348-bf50-f12d51f48f72', -- [ID 4490] نظم التشغيل (لا يوجد ملف قابل للتنزيل)
  'b40ad1ad-eeaf-5d3d-a963-310fa901703c', -- [ID 1836] Database Project (لا يوجد ملف قابل للتنزيل)
  '15768f34-0641-5e7e-9ff9-401a3991cd3d', -- [ID 2969] Mini Project 2023 (لا يوجد ملف قابل للتنزيل)
  'ece023ca-4652-54ec-8eb0-6cf6caba93f5', -- [ID 2238] Second (لا يوجد ملف قابل للتنزيل)
  'b88cf837-a71c-59fe-8cd3-b716709b21fe', -- [ID 432] المشروع (لا يوجد ملف قابل للتنزيل)
  'c0f397a8-978a-5ba4-ad57-ac6f55c7c377', -- [ID 4441] المشروع الاول والثاني (لا يوجد ملف قابل للتنزيل)
  '99b55aff-69c2-50f9-8f83-0bfc4eee1d3c', -- [ID 2227] سلايدات نظم وقواعد البيانات كاملة (لا يوجد ملف قابل للتنزيل)
  '9630c337-9b80-5dbd-92b8-78814d0ed67f', -- [ID 4489] نظم قواعد البيانات (لا يوجد ملف قابل للتنزيل)
  'b9b4be63-26e7-5f01-baf1-46cca277c91b', -- [ID 4924] جميع ما يلزم للفصل الأول لطلاب الهندسة (لا يوجد ملف قابل للتنزيل)
  'cd3361f7-0dae-539c-9837-ad56c1e40909', -- [ID 3850] سلايدات المادة (لا يوجد ملف قابل للتنزيل)
  'e791b8d6-e20d-51b1-ad4c-fa68ad243be8', -- [ID 5091] هندسة الأنظمة (لا يوجد ملف قابل للتنزيل)
  '9e6815ad-a84c-5a39-81c9-40d632e1ae95', -- [ID 3285] مشروع المساق (لا يوجد ملف قابل للتنزيل)
  '919c13e7-e351-5c58-a481-38d22d1f97b7', -- [ID 3734] Midterm Exam (لا يوجد ملف قابل للتنزيل)
  'd2f0717e-4884-525d-ac2d-c3f7073dc2d3', -- [ID 3754] Everthing (Assignments and presentation) (لا يوجد ملف قابل للتنزيل)
  '7db9a557-416e-5f50-996b-b4cbee6ef7cc', -- [ID 3722] All Quizes &amp; Exams (لا يوجد ملف قابل للتنزيل)
  '60107039-5617-590d-b75c-a358f868698c', -- [ID 3738] Math 142 ******** 142 (لا يوجد ملف قابل للتنزيل)
  'dffc50ba-b47f-534d-9f33-ae9ea1a0201e', -- [ID 3755] Dilemma Presenation (لا يوجد ملف قابل للتنزيل)
  '35b90cbe-c256-51a0-98e7-a59d2c6cb77a', -- [ID 3739] Midterm Exam (لا يوجد ملف قابل للتنزيل)
  '8a124fa5-01f3-50f5-a10a-eb18bb462408', -- [ID 3748] Midterm Exam (لا يوجد ملف قابل للتنزيل)
  '97fbc3b6-a18d-5476-b6ea-b7753d1327e1', -- [ID 3721] All Quizes &amp; Exams (لا يوجد ملف قابل للتنزيل)
  'cfa50c63-d760-5024-988c-69b208e2099a', -- [ID 3735] English 102 --- Quizes &amp; Exams (لا يوجد ملف قابل للتنزيل)
  'acf9d815-29c0-58ee-9bf4-b53ecfd674f0', -- [ID 3736] Exams &amp; Quizeshttps://drive.google.com/drive/folders/1831KRtSobwZQ48OI0LSjGfPfn81sYaWp?usp=sharing (لا يوجد ملف قابل للتنزيل)
  '0b557d2b-25ef-52db-9cee-854f2f1eaf49', -- [ID 3737] Exams (لا يوجد ملف قابل للتنزيل)
  '580e6734-4654-5dd5-adc6-eae914d771dd', -- [ID 3752] ANN Project (لا يوجد ملف قابل للتنزيل)
  'd7cfa18f-24c9-5e50-9331-d3ca31baea98', -- [ID 3750] Exams &amp; Assignments (لا يوجد ملف قابل للتنزيل)
  '284fd1ea-c1fb-5b0a-9597-485c5b8bfab6', -- [ID 3925] All my exams on google drive (The link) (لا يوجد ملف قابل للتنزيل)
  'cf701f17-783d-565f-8f35-4a1610b36766', -- [ID 3726] First Exam (لا يوجد ملف قابل للتنزيل)
  '73e6e3fd-942e-5872-8711-637272015ca9', -- [ID 3743] Midterm Exam (لا يوجد ملف قابل للتنزيل)
  '1727e8a8-b2fc-5026-8dfd-567559a3924b', -- [ID 3740] Physics 131*** (لا يوجد ملف قابل للتنزيل)
  '255aa0f8-fbe4-54b7-90a1-1e67e1765ec2', -- [ID 3741] Physics 132**** (لا يوجد ملف قابل للتنزيل)
  '4fda0d91-0a89-5112-8b5a-3d1a335559e1', -- [ID 3742] Physics Lab 113 **** (Lab) Exams &amp; Quizes (لا يوجد ملف قابل للتنزيل)
  'bc4d3940-b628-5c3a-8847-073adeefab08', -- [ID 3727] Reports (لا يوجد ملف قابل للتنزيل)
  'cae0f3f6-f8e8-581a-a9fe-54922b0ed9b7', -- [ID 3728] Diagrams &amp; Assignments (لا يوجد ملف قابل للتنزيل)
  '3bb8b502-5f73-50d3-a96c-515100467998', -- [ID 3751] Exams &amp; Quizeshttps://drive.google.com/drive/folders/1wub7z__N8HFvxI2Yu8CSXjDo3BdYouMV?usp=sharing (لا يوجد ملف قابل للتنزيل)
  '226dd02e-e185-55db-bff6-09414d15a621', -- [ID 3744] SRS Documentation (لا يوجد ملف قابل للتنزيل)
  '49ecd0eb-0987-50b7-a328-c34fdec845ee', -- [ID 3745] Quiz &amp; Midterm (لا يوجد ملف قابل للتنزيل)
  '9683f883-405c-5753-9e70-cc037166aa7b', -- [ID 3746] Assignmet (لا يوجد ملف قابل للتنزيل)
  '53a8c4f5-4dda-5f0d-83b1-8535a82aca5c', -- [ID 3749] Practical Exam (لا يوجد ملف قابل للتنزيل)
  '575ae66d-c660-533b-bc16-cef95f4d3ca7', -- [ID 4726] تلخيص مادة كالك ٢ (لا يوجد ملف قابل للتنزيل)
  'd04f4fd8-7d30-5142-bdec-fcaec8df0b31', -- [ID 4724] تلخيص مادة كالك ١ (لا يوجد ملف قابل للتنزيل)
  '94c612bf-4070-5f0f-907d-f384b53975dc', -- [ID 4725] تلخيص مادة فيزياء عامة 2 (لا يوجد ملف قابل للتنزيل)
  '060d41c6-1de7-5b8b-8c80-f51c13004449' -- [ID 4727] تلخيص مادة كيمياء عامة ١ (لا يوجد ملف قابل للتنزيل)
);

commit;
