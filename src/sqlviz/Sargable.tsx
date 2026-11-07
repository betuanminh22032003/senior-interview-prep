import { useState } from 'react';
import { Code, Seg, VizFrame } from './ui';

interface Pattern {
  id: string;
  label: string;
  before: string;
  after: string;
  why: string;
  fix: string;
  source?: string;
}

const PATTERNS: Pattern[] = [
  {
    id: 'case',
    label: 'CASE bao cột',
    before: `WHERE t.service_code = @svc
  AND 1 = CASE WHEN @school_id > 0
               THEN CASE WHEN t.school_id = @school_id THEN 1 ELSE 0 END
               ELSE 1 END`,
    after: `IF @school_id > 0
  SELECT ... FROM dbo.StudentStat t
  WHERE t.service_code = @svc AND t.school_id = @school_id;
ELSE
  SELECT ... FROM dbo.StudentStat t
  WHERE t.service_code = @svc;`,
    why: 'Cột school_id nằm trong biểu thức CASE nên optimizer không lấy được giá trị để seek; nó phải tính CASE cho từng dòng.',
    fix: 'Tách hai nhánh IF/ELSE. Mỗi nhánh có plan riêng, seek theo index (service_code, school_id).',
    source: 'Vấn đề 4: 3.567 reads/lần.',
  },
  {
    id: 'catchall',
    label: 'Catch-all (@p = 0 OR ...)',
    before: `WHERE (@school_id = 0 OR t.school_id = @school_id)
  AND (@block = 0 OR t.block = @block)`,
    after: `WHERE (@school_id = 0 OR t.school_id = @school_id)
  AND (@block = 0 OR t.block = @block)
OPTION (RECOMPILE);`,
    why: 'Plan được dùng lại phải đúng cho mọi tổ hợp tham số, kể cả @school_id = 0, nên optimizer chọn scan cho an toàn.',
    fix: 'OPTION (RECOMPILE) nhúng giá trị thật vào lúc compile, các vế @p = 0 bị loại. Proc gọi hàng triệu lần thì dùng dynamic SQL có tham số (sp_executesql) chỉ thêm điều kiện cần.',
  },
  {
    id: 'convert',
    label: 'Hàm bao cột',
    before: `WHERE CONVERT(NVARCHAR(20), t.user_id) LIKE '%' + @kw + '%'
   OR t.full_name LIKE '%' + @kw + '%'`,
    after: `DECLARE @uid BIGINT = TRY_CAST(@kw AS BIGINT);
IF @uid IS NOT NULL
  SELECT ... WHERE t.user_id = @uid;
ELSE
  SELECT ... WHERE t.full_name LIKE @kw + N'%';`,
    why: 'CONVERT trên cột user_id buộc tính lại giá trị cho từng dòng; LIKE có % ở đầu không dùng được thứ tự của index.',
    fix: 'Nhận diện từ khoá là mã số hay tên. Mã số thì so sánh bằng; tên thì LIKE bắt đầu bằng từ khoá (seek theo dải).',
    source: 'Cụm 4 – Mục 9: scan dù có index trên user_id.',
  },
  {
    id: 'list',
    label: "LIKE '%x%' trên cột danh sách",
    before: `WHERE u.create_date >= @from
  AND u.list_service_code LIKE '%IOK%'   -- '[IOE],[IOK]'`,
    after: `-- Bảng con UserService(user_id, service_code),
-- index (service_code, user_id)
WHERE u.create_date >= @from
  AND EXISTS (SELECT 1 FROM dbo.UserService s
              WHERE s.user_id = u.user_id
                AND s.service_code = 'IOK');`,
    why: 'Chuỗi danh sách lưu trong một cột chỉ tìm được bằng LIKE có % ở đầu, nghĩa là đọc từng dòng.',
    fix: 'Chuẩn hoá danh sách thành bảng con có index. Tìm theo mã dịch vụ trở thành seek.',
    source: 'Cụm 5 – Mục 3: 151.930 reads/lần trên bảng 120 triệu dòng.',
  },
  {
    id: 'year',
    label: 'Hàm ngày tháng',
    before: `WHERE YEAR(t.create_date) = 2026`,
    after: `WHERE t.create_date >= '20260101'
  AND t.create_date <  '20270101'`,
    why: 'YEAR() phải chạy trên từng dòng rồi mới so sánh.',
    fix: 'Viết thành dải nửa mở trên chính cột: seek từ đầu năm tới trước đầu năm sau.',
  },
  {
    id: 'implicit',
    label: 'Lệch kiểu dữ liệu',
    before: `-- cột code VARCHAR(20); C# gửi string mặc định
WHERE t.code = @code   -- @code NVARCHAR(4000)`,
    after: `-- C#: new SqlParameter("@code", SqlDbType.VarChar, 20)
WHERE t.code = @code   -- @code VARCHAR(20)`,
    why: 'NVARCHAR ưu tiên cao hơn VARCHAR nên SQL đổi cột sang NVARCHAR (CONVERT_IMPLICIT). Với SQL collation thì mất seek; với Windows collation có thể vẫn seek theo dải nhưng ước lượng kém.',
    fix: 'Khai báo tham số đúng kiểu và độ dài của cột. Plan có cảnh báo CONVERT_IMPLICIT ở toán tử SELECT là dấu hiệu cần sửa.',
  },
  {
    id: 'isnull',
    label: 'ISNULL bao cột',
    before: `WHERE ISNULL(t.status, 0) = 1`,
    after: `WHERE t.status = 1`,
    why: 'ISNULL trên cột biến điều kiện thành biểu thức tính theo từng dòng.',
    fix: 'NULL không bằng 1, nên ISNULL ở đây thừa. Với điều kiện cần NULL: viết (t.status = @s OR t.status IS NULL).',
  },
];

const CELLS = 48;
const SEEK_FROM = 20;
const SEEK_TO = 24;

export function Sargable() {
  const [id, setId] = useState(PATTERNS[0].id);
  const [mode, setMode] = useState<'before' | 'after'>('before');
  const p = PATTERNS.find((x) => x.id === id)!;
  const seek = mode === 'after';

  return (
    <VizFrame title="Cùng một index, viết điều kiện khác nhau" hint="Chọn một mẫu, rồi đổi giữa cách viết cũ và cách viết lại.">
      <div className="chips">
        {PATTERNS.map((x) => (
          <button
            key={x.id}
            className={`chip ${x.id === id ? 'active' : ''}`}
            onClick={() => {
              setId(x.id);
              setMode('before');
            }}
          >
            {x.label}
          </button>
        ))}
      </div>

      <Seg<'before' | 'after'>
        value={mode}
        onChange={setMode}
        options={[
          { value: 'before', label: 'Cách viết cũ' },
          { value: 'after', label: 'Viết lại' },
        ]}
      />

      <Code>{seek ? p.after : p.before}</Code>

      <div className="strip-row">
        <span className="strip-label">Tầng lá index (đã sắp theo cột lọc)</span>
        <div className="strip strip-dense" key={`${id}-${mode}`}>
          {Array.from({ length: CELLS }, (_, i) => (
            <i
              key={i}
              className={seek ? (i >= SEEK_FROM && i < SEEK_TO ? 'on seek' : '') : 'on scan'}
              style={{ '--d': `${i * 14}ms` } as React.CSSProperties}
            />
          ))}
        </div>
      </div>

      <div className={`verdict ${seek ? 'tone-good' : 'tone-bad'}`}>
        <strong>{seek ? 'Index Seek' : 'Index Scan'}</strong>
        <span>{seek ? 'Cột nằm trong Seek Predicates: đi thẳng tới dải cần đọc.' : 'Cột chỉ nằm trong Predicate: đọc mọi dòng rồi lọc.'}</span>
      </div>

      <p className="viz-note">
        <strong>Vì sao:</strong> {p.why}
      </p>
      <p className="viz-note">
        <strong>Sửa:</strong> {p.fix}
      </p>
      {p.source && <p className="viz-note muted">Báo cáo: {p.source}</p>}
    </VizFrame>
  );
}
