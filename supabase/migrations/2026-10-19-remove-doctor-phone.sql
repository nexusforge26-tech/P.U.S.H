-- حذف خانة رقم الهاتف نهائيًا من الدكاترة وطلباتهم (العمود + بياناته)
begin;

alter table doctor_submissions drop constraint if exists doctor_submissions_len_check;

alter table doctors            drop column if exists phone;
alter table doctor_submissions drop column if exists phone;

alter table doctor_submissions add constraint doctor_submissions_len_check check (
  char_length(full_name) <= 150 and char_length(email) <= 150
  and char_length(coalesce(office_location,'')) <= 150
  and cardinality(courses) <= 30
) not valid;

commit;
