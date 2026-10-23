type Student=Record<string,any>
export function studentLabel(student:Student){
 return [student.name,student.english_name,student.context_label].filter(Boolean).join(' · ')
}
export function isStudentIdentifierHeader(label:unknown){
 return /^(?:(?:校宝|来源)?(?:学生|学员)(?:来源)?(?:编号|编码|id)|学号|student[_-]?(?:id|number|no|code))$/i.test(String(label||'').replace(/\s/g,''))
}
