# 일본어 공부장

개인용 일본어 학습 웹앱입니다. 단어·표현과 한↔일 번역 문장을 저장·검색하고, 퀴즈와 오답 복습을 할 수 있어요.
React + TypeScript + Vite로 만들었고, 서버 없이 **브라우저 localStorage**에 저장합니다. (PC·스마트폰 모두 사용 가능)

초기 데이터는 비어 있어요. 예시 단어를 미리 넣어 두지 않았습니다.

## 기능

- **단어장**: 일본어 / 읽는 법(히라가나) / 한국어 뜻 / 예문(일/한) / 메모 / 태그 / 생성일. 검색·태그 필터·추가·수정·삭제
- **번역장**: 원문 / 번역문 / 방향(한→일, 일→한) / 상황 메모 / 태그. 검색·방향·태그 필터·추가·수정·삭제
- **퀴즈**: 단어장에서 무작위 출제.
  - 뜻 → 일본어(직접 입력, 일본어 표기 또는 히라가나 읽기 모두 정답 인정, 기본 모드)
  - 일본어 → 뜻(답을 보고 스스로 채점)
  - 틀린 단어가 오답으로 기록되고 "오답만 다시 풀기"가 가능해요. 오답 모드에서 맞히면 오답 목록에서 빠집니다.
- **데이터 관리**: JSON 내보내기 / 가져오기. 가져오기 전에 형식 검사를 하고, 추가·덮어쓰기·건너뜀·삭제 건수를 미리 보여준 뒤 적용합니다.
- 삭제 후에는 알림과 함께 **되돌리기**가 가능해요.

## 실행 방법 (로컬)

Node.js 20 이상이 필요합니다.

```bash
npm install
npm run dev
```

터미널에 표시되는 주소(기본 http://localhost:5173)를 열어요.

| 명령 | 설명 |
| --- | --- |
| `npm run dev` | 개발 서버 |
| `npm run typecheck` | 타입 검사 |
| `npm test` | 가져오기 검증·병합 로직 테스트 (vitest) |
| `npm run build` | 타입 검사 + 프로덕션 빌드(`dist/`) |
| `npm run preview` | 빌드 결과 미리보기 |

## GitHub Pages 배포

1. GitHub에 새 저장소를 만들고 이 프로젝트를 `main` 브랜치로 push 합니다.
2. 저장소 **Settings → Pages → Build and deployment → Source**를 **GitHub Actions**로 설정합니다.
3. `main`에 push 하면 `.github/workflows/deploy.yml`이 테스트·빌드 후 자동 배포해요. (Actions 탭에서 수동 실행도 가능)
4. 배포 주소: `https://<GitHub 사용자명>.github.io/<저장소 이름>/`

**저장소 이름과 경로 설정**
- `vite.config.ts`의 `base`가 `'./'`(상대 경로)라서 **저장소 이름을 코드에 적을 필요가 없어요.** 저장소 이름을 바꿔도 정적 파일 경로가 깨지지 않습니다.
- 화면 이동은 주소의 `#/words` 같은 해시 방식이라 새로고침해도 404가 나지 않아요.
- 기본 브랜치가 `main`이 아니면 `deploy.yml`의 `branches`를 바꿔 주세요.
- 비공개 저장소에서 Pages를 쓰려면 GitHub 요금제가 Pages를 지원해야 합니다.
- 시크릿/API 키는 사용하지 않아요. 프론트엔드 코드에 비밀값을 넣지 마세요.

## 데이터 저장 위치와 주의점

- 데이터는 **현재 브라우저의 localStorage**(`jp-study:data:v1`)에만 있어요. PC와 스마트폰은 서로 동기화되지 않습니다.
- 사이트 데이터 삭제, 시크릿 모드, 브라우저 교체 시 사라질 수 있으니 **주기적으로 JSON으로 내보내 백업**하세요.
- 기기 간 옮기기: 한쪽에서 내보내기 → 다른 쪽에서 가져오기.

## JSON 가져오기

ChatGPT 등으로 정리한 목록을 아래 형식으로 만들어 가져올 수 있어요. (ChatGPT API는 직접 호출하지 않습니다.)

```json
{
  "words": [
    { "japanese": "勉強", "reading": "べんきょう", "meaning": "공부",
      "exampleJa": "毎日日本語を勉強します。", "exampleKo": "매일 일본어를 공부합니다.",
      "memo": "", "tags": ["기초"] }
  ],
  "translations": [
    { "direction": "ko-ja", "source": "처음 뵙겠습니다.", "target": "はじめまして。",
      "memo": "첫 인사", "tags": ["인사"] }
  ]
}
```

- 단어 필수: `japanese`, `meaning` / 번역 필수: `direction`(`"ko-ja"` | `"ja-ko"`), `source`, `target`. 나머지는 생략 가능해요.
- 형식에 문제가 있으면 위치(`words[3]` 등)와 이유를 보여 주고 **아무것도 바꾸지 않아요.**
- **ID**: `id`가 있으면 그대로 쓰고, 없으면 내용(단어: 일본어+읽는 법 / 번역: 방향+원문)으로 안정적인 ID를 만듭니다. 그래서 같은 파일을 두 번 가져와도 중복되지 않아요.
- **가져오기 방식**
  - 병합(기존 유지): 새 항목만 추가, ID가 같으면 건너뜀 (기본값)
  - 병합(덮어쓰기): 새 항목 추가, ID가 같으면 가져온 내용으로 교체
  - 전체 교체: 기존 데이터를 모두 지우고 파일 내용으로 교체 (확인창 표시)
- 내용은 같은데 ID만 다른 단어는 중복될 수 있어서, 해당 개수를 미리 경고해 줘요.

## 구조 / 나중에 Supabase로 교체하기

```
src/
  types.ts                      데이터 모델 (Word, Translation, AppData)
  storage/
    repository.ts               저장 계층 인터페이스 (Promise 기반)
    localStorageRepository.ts   localStorage 구현
    index.ts                    사용할 구현체 선택 (교체 지점)
  store.tsx                     화면 상태 + 저장 계층 호출 (화면은 repository를 직접 모르는 구조)
  lib/                          ID 생성, 검색 정규화, JSON 검증·병합 로직(+테스트)
  pages/                        단어장 / 번역장 / 퀴즈 / 데이터 관리
```

원격 저장소로 바꿀 때는 `Repository` 인터페이스를 구현한 클래스(예: `SupabaseRepository`)를 만들고
`src/storage/index.ts`의 `repository`만 교체하면 돼요. 화면 코드는 수정하지 않아도 됩니다.
Supabase를 쓸 경우 `anon` 키는 공개되는 값이므로 반드시 Row Level Security를 설정하고, `service_role` 키 등 비밀값은 프론트엔드에 넣지 마세요.
