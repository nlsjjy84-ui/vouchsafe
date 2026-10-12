import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { DataSource } from 'typeorm';
import { AppModule } from '../app.module';
import { BountiesService } from '../modules/bounties/bounties.service';
import { DisputesService } from '../modules/disputes/disputes.service';
import { User } from '../modules/users/entities/user.entity';
import { Bounty } from '../modules/bounties/entities/bounty.entity';
import { Certification } from '../modules/certifications/entities/certification.entity';
import { UserRole } from '../common/enums/user-role.enum';
import { DomainType } from '../common/enums/domain-type.enum';
import { ServiceType } from '../common/enums/service-type.enum';
import { VerificationStatus, VerificationTrack } from '../common/enums/verification-track.enum';
import { BountyStatus } from '../common/enums/bounty-status.enum';

/**
 * 실제 사이트 시연용 목데이터 (지역 찾기·프로젝트 둘러보기·AI 매칭이 비어 보이지 않게).
 *  - 시연 전문가 50명(전원 인증 승인, 활동 지역 동 단위) + 모집 중 프로젝트 30개(만남 지역 동 단위)
 *  - 서울·경기에 많이, 나머지는 전국 광역시·도에 고르게. 좌표는 각 동의 대략적인 중심(시연용)이다.
 *  - 기존 시연 전문가(match-*, expert*@demo.com)에 지역이 없으면 지역만 붙인다.
 *  - 멱등: 이미 있는 계정·같은 제목의 프로젝트는 건너뛴다. 여러 번 실행해도 중복이 생기지 않는다.
 *  - 시연 계정은 로그인용이 아니다(비밀번호는 무작위). 이메일은 모두 @demo.com.
 * 사용법: SEED_LIVE_CONFIRM=YES 와 DATABASE_URL 을 지정하고 실행 (seed-live-mock.bat 이 대신 해 준다)
 */

type R = [sido: string, sigungu: string, dong: string, lat: number, lng: number];
const P: Record<string, R> = {
  역삼: ['서울', '강남구', '역삼동', 37.5006, 127.0364],
  대치: ['서울', '강남구', '대치동', 37.4946, 127.0626],
  서초: ['서울', '서초구', '서초동', 37.4837, 127.0324],
  반포: ['서울', '서초구', '반포동', 37.5047, 127.006],
  잠실: ['서울', '송파구', '잠실동', 37.5133, 127.1001],
  문정: ['서울', '송파구', '문정동', 37.4859, 127.1225],
  서교: ['서울', '마포구', '서교동', 37.5547, 126.9206],
  공덕: ['서울', '마포구', '공덕동', 37.5446, 126.9516],
  성수: ['서울', '성동구', '성수동1가', 37.5446, 127.0557],
  여의도: ['서울', '영등포구', '여의도동', 37.5219, 126.9245],
  문래: ['서울', '영등포구', '문래동3가', 37.5179, 126.895],
  구로: ['서울', '구로구', '구로동', 37.4954, 126.8875],
  마곡: ['서울', '강서구', '마곡동', 37.5602, 126.8254],
  상계: ['서울', '노원구', '상계동', 37.6542, 127.0568],
  봉천: ['서울', '관악구', '봉천동', 37.4823, 126.9416],
  장안: ['서울', '동대문구', '장안동', 37.5704, 127.07],
  한남: ['서울', '용산구', '한남동', 37.5347, 127.001],
  불광: ['서울', '은평구', '불광동', 37.6104, 126.93],
  자양: ['서울', '광진구', '자양동', 37.5346, 127.0821],
  길음: ['서울', '성북구', '길음동', 37.6067, 127.0249],
  정자: ['경기', '성남시 분당구', '정자동', 37.3669, 127.1085],
  서현: ['경기', '성남시 분당구', '서현동', 37.3838, 127.1229],
  영통: ['경기', '수원시 영통구', '영통동', 37.2517, 127.0713],
  인계: ['경기', '수원시 팔달구', '인계동', 37.2649, 127.0302],
  풍덕천: ['경기', '용인시 수지구', '풍덕천동', 37.3225, 127.0951],
  보정: ['경기', '용인시 기흥구', '보정동', 37.3197, 127.1086],
  장항: ['경기', '고양시 일산동구', '장항동', 37.6553, 126.772],
  화정: ['경기', '고양시 덕양구', '화정동', 37.6346, 126.8326],
  덕풍: ['경기', '하남시', '덕풍동', 37.5393, 127.2148],
  반송: ['경기', '화성시', '반송동', 37.2005, 127.0727],
  평촌: ['경기', '안양시 동안구', '평촌동', 37.3897, 126.9637],
  중동: ['경기', '부천시', '중동', 37.5037, 126.764],
  장기: ['경기', '김포시', '장기동', 37.643, 126.668],
  다산: ['경기', '남양주시', '다산동', 37.6187, 127.153],
  철산: ['경기', '광명시', '철산동', 37.4764, 126.8687],
  비전: ['경기', '평택시', '비전동', 36.995, 127.104],
  의정부: ['경기', '의정부시', '의정부동', 37.7381, 127.0458],
  구월: ['인천', '남동구', '구월동', 37.4486, 126.7053],
  송도: ['인천', '연수구', '송도동', 37.3826, 126.6567],
  청라: ['인천', '서구', '청라동', 37.534, 126.643],
  부평: ['인천', '부평구', '부평동', 37.492, 126.724],
  우동: ['부산', '해운대구', '우동', 35.1631, 129.1635],
  부전: ['부산', '부산진구', '부전동', 35.1579, 129.0597],
  광안: ['부산', '수영구', '광안동', 35.158, 129.113],
  범어: ['대구', '수성구', '범어동', 35.8588, 128.6306],
  상인: ['대구', '달서구', '상인동', 35.816, 128.537],
  봉명: ['대전', '유성구', '봉명동', 36.3526, 127.3414],
  둔산: ['대전', '서구', '둔산동', 36.351, 127.378],
  치평: ['광주', '서구', '치평동', 35.1526, 126.8497],
  삼산: ['울산', '남구', '삼산동', 35.539, 129.338],
  나성: ['세종', '세종시', '나성동', 36.484, 127.259],
  불당: ['충남', '천안시 서북구', '불당동', 36.8151, 127.1139],
  복대: ['충북', '청주시 흥덕구', '복대동', 36.633, 127.432],
  상남: ['경남', '창원시 성산구', '상남동', 35.223, 128.681],
  연동: ['제주', '제주시', '연동', 33.489, 126.4983],
};

const D = DomainType;
// [이름, 분야, 활동 지역] — 서울 20, 경기 14, 인천 4, 부산 3, 대구 2, 대전 2, 광주·울산·세종·충남·경남 각 1
export const EXPERTS: [string, DomainType, string][] = [
  ['김민준', D.REAL_ESTATE_TITLE_ANALYSIS, '역삼'], ['이서연', D.REAL_ESTATE_TITLE_ANALYSIS, '잠실'],
  ['박지훈', D.VEHICLE_DIAGNOSTICS, '장안'], ['최수아', D.BUILDING_DEFECT_INSPECTION, '반포'],
  ['정우진', D.DEV_CODE_REVIEW, '서교'], ['강하은', D.REAL_ESTATE_TITLE_ANALYSIS, '공덕'],
  ['조현우', D.VEHICLE_DIAGNOSTICS, '성수'], ['윤지민', D.TAX_STRUCTURE_FACTCHECK, '여의도'],
  ['장도윤', D.BUILDING_DEFECT_INSPECTION, '상계'], ['임채원', D.STARTUP_CONTRACT_REVIEW, '서초'],
  ['한승민', D.BACKEND_DB_TUNING, '구로'], ['오예린', D.REAL_ESTATE_TITLE_ANALYSIS, '마곡'],
  ['서준혁', D.FIRE_SAFETY_INSPECTION, '문래'], ['신유진', D.AUDIO_MASTERING_REVIEW, '한남'],
  ['권태윤', D.VEHICLE_DIAGNOSTICS, '봉천'], ['황보람', D.REAL_ESTATE_TITLE_ANALYSIS, '불광'],
  ['안재원', D.BUILDING_DEFECT_INSPECTION, '자양'], ['송다인', D.MOBILE_QA_AUTOMATION, '대치'],
  ['류성훈', D.VEHICLE_DIAGNOSTICS, '길음'], ['전소희', D.REAL_ESTATE_TITLE_ANALYSIS, '문정'],
  ['홍기현', D.REAL_ESTATE_TITLE_ANALYSIS, '정자'], ['고은비', D.BUILDING_DEFECT_INSPECTION, '서현'],
  ['문준서', D.VEHICLE_DIAGNOSTICS, '영통'], ['양혜진', D.TAX_STRUCTURE_FACTCHECK, '인계'],
  ['손동욱', D.REAL_ESTATE_TITLE_ANALYSIS, '풍덕천'], ['배수빈', D.DEV_CODE_REVIEW, '보정'],
  ['백지성', D.VEHICLE_DIAGNOSTICS, '장항'], ['허윤아', D.BUILDING_DEFECT_INSPECTION, '화정'],
  ['유민석', D.FIRE_SAFETY_INSPECTION, '덕풍'], ['남궁현', D.REAL_ESTATE_TITLE_ANALYSIS, '반송'],
  ['심가은', D.STARTUP_CONTRACT_REVIEW, '평촌'], ['노태호', D.VEHICLE_DIAGNOSTICS, '중동'],
  ['하지원', D.BUILDING_DEFECT_INSPECTION, '다산'], ['곽민성', D.BACKEND_DB_TUNING, '철산'],
  ['성나연', D.REAL_ESTATE_TITLE_ANALYSIS, '구월'], ['차영훈', D.VEHICLE_DIAGNOSTICS, '송도'],
  ['주하린', D.BUILDING_DEFECT_INSPECTION, '청라'], ['우상민', D.FIRE_SAFETY_INSPECTION, '부평'],
  ['구슬기', D.REAL_ESTATE_TITLE_ANALYSIS, '우동'], ['민경수', D.VEHICLE_DIAGNOSTICS, '부전'],
  ['진서현', D.INDIE_GAME_QA, '광안'], ['엄태준', D.REAL_ESTATE_TITLE_ANALYSIS, '범어'],
  ['채은서', D.DEV_CODE_REVIEW, '상인'], ['원지호', D.VEHICLE_DIAGNOSTICS, '봉명'],
  ['천예은', D.BACKEND_DB_TUNING, '둔산'], ['방준영', D.REAL_ESTATE_TITLE_ANALYSIS, '치평'],
  ['공하늘', D.BUILDING_DEFECT_INSPECTION, '삼산'], ['변시우', D.STARTUP_CONTRACT_REVIEW, '나성'],
  ['여은채', D.VEHICLE_DIAGNOSTICS, '불당'], ['추동건', D.TAX_STRUCTURE_FACTCHECK, '상남'],
];

export const CLIENTS: [string, string][] = [
  ['mock-client1@demo.com', '김지영'], ['mock-client2@demo.com', '박성호'], ['mock-client3@demo.com', '이은주'],
  ['mock-client4@demo.com', '최민호'], ['mock-client5@demo.com', '정다혜'], ['mock-client6@demo.com', '한상우'],
];

// [분야, 제목, 내용, 금액, 지역, 동행 장소(있으면 현장 동행)] — 서울 11, 경기 9, 인천 3, 부산 2, 대구·대전·광주·충북·제주 각 1
export const PROJECTS: [DomainType, string, string, number, string, string?][] = [
  [D.REAL_ESTATE_TITLE_ANALYSIS, '역삼동 오피스텔 전세 계약 전 권리분석', '전세 계약을 앞둔 오피스텔의 등기부 근저당과 선순위 보증금을 확인하고 계약해도 되는지 위험 요소를 정리해 주세요.', 200000, '역삼'],
  [D.REAL_ESTATE_TITLE_ANALYSIS, '잠실 아파트 매매 전 현장 임장 동행', '매수 예정인 아파트의 현장 상태와 주변 환경, 관리 상태를 함께 보고 판단해 주세요.', 280000, '잠실', '서울 송파구 잠실동 아파트 단지 정문'],
  [D.VEHICLE_DIAGNOSTICS, '장안평 중고차 매매단지 SUV 구매 동행 점검', '구매 예정인 중고 SUV의 사고 수리 흔적, 침수 여부, 하부 부식을 현장에서 함께 점검해 주세요.', 160000, '장안', '서울 동대문구 장안평 중고차 매매단지 입구'],
  [D.BUILDING_DEFECT_INSPECTION, '반포동 신축 아파트 사전점검 하자 진단', '입주 전 사전점검에 동행해 마감 불량, 누수 흔적, 결로 위험을 점검하고 하자 목록으로 정리해 주세요.', 250000, '반포', '서울 서초구 반포동 신축 단지 관리사무소 앞'],
  [D.DEV_CODE_REVIEW, '쇼핑몰 결제 모듈 보안 코드 리뷰', '결제 모듈의 입력 검증과 권한 확인 로직을 점검하고 취약점 목록과 개선안을 정리해 주세요.', 350000, '서교'],
  [D.REAL_ESTATE_TITLE_ANALYSIS, '공덕동 빌라 전세사기 위험 점검', '등기부와 건축물대장을 대조해 전세사기 위험 신호가 있는지 확인하고 체크리스트로 정리해 주세요.', 180000, '공덕'],
  [D.VEHICLE_DIAGNOSTICS, '성수동 수입 중고차 계약 전 성능 확인', '성능기록부와 실차 상태가 맞는지 대조하고 시운전으로 엔진·변속 상태를 확인해 주세요.', 190000, '성수', '서울 성동구 성수동 전시장 앞'],
  [D.TAX_STRUCTURE_FACTCHECK, '프리랜서 종합소득세 절세 구조 팩트체크', '지난해 소득과 경비 처리 방식이 맞는지 확인하고 절세 방안이 실제로 가능한지 점검해 주세요.', 150000, '여의도'],
  [D.BUILDING_DEFECT_INSPECTION, '상계동 구축 아파트 누수 원인 진단', '윗집 누수로 천장에 얼룩이 생겼습니다. 원인 위치를 추정하고 수리 범위를 정리해 주세요.', 170000, '상계', '서울 노원구 상계동 해당 아파트 동 입구'],
  [D.STARTUP_CONTRACT_REVIEW, '스타트업 투자계약서 독소조항 검토', '시드 투자 계약서의 우선매수권, 동반매도권 조항이 과도한지 검토하고 수정 의견을 주세요.', 400000, '서초'],
  [D.FIRE_SAFETY_INSPECTION, '문래동 소규모 공장 소방시설 점검', '임차한 소규모 공장의 소화기, 감지기, 비상구 상태를 점검하고 보완 목록을 정리해 주세요.', 210000, '문래', '서울 영등포구 문래동 공장 건물 1층'],
  [D.REAL_ESTATE_TITLE_ANALYSIS, '분당 정자동 아파트 경매 물건 임장 대행', '경매 예정 아파트의 현장 상태, 점유 현황, 인수해야 할 권리를 확인해 임장 보고서로 정리해 주세요.', 320000, '정자', '경기 성남시 분당구 정자동 해당 단지 정문'],
  [D.BUILDING_DEFECT_INSPECTION, '서현동 단독주택 매수 전 하자 점검', '매수 예정 단독주택의 균열, 누수, 단열 상태를 점검하고 수리 예상 범위를 알려 주세요.', 260000, '서현', '경기 성남시 분당구 서현동 해당 주택 앞'],
  [D.VEHICLE_DIAGNOSTICS, '영통 중고 전기차 배터리 상태 진단', '구매 검토 중인 중고 전기차의 배터리 상태와 충전 이력을 확인해 잔존 수명을 정리해 주세요.', 140000, '영통'],
  [D.REAL_ESTATE_TITLE_ANALYSIS, '수지 풍덕천동 아파트 전세 권리분석', '전세 계약 전 근저당과 가압류 여부, 임대인 체납 위험을 확인해 주세요.', 190000, '풍덕천'],
  [D.DEV_CODE_REVIEW, '사내 관리자 페이지 리액트 성능 리뷰', '관리자 페이지 목록 화면이 느립니다. 컴포넌트 구조와 상태 관리를 리뷰하고 개선안을 주세요.', 240000, '보정'],
  [D.VEHICLE_DIAGNOSTICS, '일산 중고 화물차 정비 이력 확인 동행', '구매 예정 1톤 화물차의 정비 이력과 주행거리 조작 여부를 현장에서 함께 확인해 주세요.', 150000, '장항', '경기 고양시 일산동구 장항동 매매상사 앞'],
  [D.FIRE_SAFETY_INSPECTION, '하남 상가 임차 전 소방 안전 점검', '임차 예정 상가의 스프링클러와 비상조명, 피난 동선을 점검해 주세요.', 200000, '덕풍', '경기 하남시 덕풍동 상가 건물 1층'],
  [D.REAL_ESTATE_TITLE_ANALYSIS, '동탄 신도시 분양권 전매 위험 확인', '분양권 전매 계약 전 권리 관계와 전매 제한 여부, 위험 요소를 정리해 주세요.', 230000, '반송'],
  [D.BUILDING_DEFECT_INSPECTION, '다산동 신축 빌라 결로·곰팡이 원인 진단', '입주 후 결로와 곰팡이가 심합니다. 원인과 보수 방법, 하자 청구 가능성을 정리해 주세요.', 180000, '다산', '경기 남양주시 다산동 해당 빌라 입구'],
  [D.REAL_ESTATE_TITLE_ANALYSIS, '구월동 상가 임차 전 등기부 권리분석', '상가 임차 전 소유권과 권리 제한 사항, 선순위 임차인 여부를 확인해 주세요.', 200000, '구월'],
  [D.VEHICLE_DIAGNOSTICS, '송도 중고 세단 엔진·변속기 진단 동행', '시운전에 동행해 엔진 소음과 변속 충격을 확인하고 수리 예상 비용을 정리해 주세요.', 170000, '송도', '인천 연수구 송도동 중고차 전시장 앞'],
  [D.BUILDING_DEFECT_INSPECTION, '청라 아파트 입주 사전점검 동행', '입주 사전점검에 동행해 도배, 타일, 창호 하자를 점검하고 목록으로 정리해 주세요.', 220000, '청라', '인천 서구 청라동 단지 커뮤니티센터 앞'],
  [D.REAL_ESTATE_TITLE_ANALYSIS, '해운대 오피스텔 매매 전 임장 대행', '매수 예정 오피스텔의 현장 상태와 관리비, 공실 현황을 확인해 임장 보고서로 정리해 주세요.', 260000, '우동', '부산 해운대구 우동 해당 오피스텔 로비'],
  [D.VEHICLE_DIAGNOSTICS, '서면 중고 경차 구매 전 점검', '첫 차로 구매할 중고 경차의 사고 이력과 소모품 상태를 확인해 주세요.', 120000, '부전'],
  [D.REAL_ESTATE_TITLE_ANALYSIS, '범어동 아파트 전세 계약 전 위험 확인', '전세 계약 전 등기부와 임대인 정보를 확인하고 보증보험 가입 가능 여부를 점검해 주세요.', 180000, '범어'],
  [D.BACKEND_DB_TUNING, '예약 시스템 조회 쿼리 인덱스 개선', '예약 목록 조회가 3초 이상 걸립니다. 실행계획을 분석해 인덱스 개선안과 전후 비교표를 주세요.', 300000, '둔산'],
  [D.REAL_ESTATE_TITLE_ANALYSIS, '광주 상무지구 원룸 건물 매수 전 권리분석', '다가구 원룸 건물 매수 전 임차인 보증금 총액과 근저당을 확인해 위험도를 정리해 주세요.', 280000, '치평'],
  [D.VEHICLE_DIAGNOSTICS, '청주 중고 SUV 침수 여부 점검', '침수 이력이 의심되는 중고 SUV의 실내 흔적과 전장 상태를 점검해 주세요.', 150000, '복대', '충북 청주시 흥덕구 복대동 매매단지 입구'],
  [D.BUILDING_DEFECT_INSPECTION, '제주 연동 타운하우스 외벽 균열 진단', '외벽에 금이 생겼습니다. 구조적 문제인지 마감 문제인지 진단하고 보수 방법을 알려 주세요.', 240000, '연동', '제주 제주시 연동 해당 타운하우스 입구'],
];

// 기존 시연 전문가에게 지역이 없으면 붙여 준다 (seed-demo-regions와 같은 배치)
const EXISTING: Record<string, string> = {
  'match-car1@demo.com': '성수', 'match-car2@demo.com': '구월', 'match-re1@demo.com': '역삼', 'match-re2@demo.com': '정자',
  'match-re3@demo.com': '우동', 'match-db1@demo.com': '잠실', 'match-db2@demo.com': '서초', 'match-db3@demo.com': '범어',
  'match-dev1@demo.com': '서교', 'match-dev2@demo.com': '봉명', 'expert@demo.com': '상계', 'expert2@demo.com': '영통',
  'expert3@demo.com': '치평', 'expert4@demo.com': '부전',
};

// 완료 이력: 앞쪽 전문가 일부에 1~2건 (평판 점수와 AI 매칭이 사람마다 갈리도록)
const HISTORY: Partial<Record<DomainType, [string, string, number][]>> = {
  [D.REAL_ESTATE_TITLE_ANALYSIS]: [
    ['빌라 근저당·전세보증금 위험 권리분석', '등기부 근저당과 선순위 보증금을 분석해 계약 위험을 보고서로 정리했습니다.', 220000],
    ['상가 임차 전 등기부 권리분석', '소유권과 권리 제한 사항을 확인해 임차 위험을 정리했습니다.', 190000],
  ],
  [D.VEHICLE_DIAGNOSTICS]: [
    ['중고 SUV 사고 이력·침수 여부 동행 점검', '현장에서 사고 수리 흔적과 침수 흔적, 하부 부식을 점검했습니다.', 160000],
    ['중고 세단 엔진·변속기 진단', '시운전으로 엔진 소음과 변속 충격을 진단하고 견적을 정리했습니다.', 170000],
  ],
  [D.BUILDING_DEFECT_INSPECTION]: [
    ['신축 아파트 사전점검 하자 진단', '마감 불량과 누수 흔적을 점검해 하자 목록을 정리했습니다.', 230000],
    ['구축 주택 누수 원인 진단', '누수 위치를 추정하고 수리 범위를 정리했습니다.', 180000],
  ],
  [D.DEV_CODE_REVIEW]: [['결제 모듈 보안 코드 리뷰', '입력 검증과 권한 확인 누락을 점검하고 개선안을 제시했습니다.', 320000]],
  [D.BACKEND_DB_TUNING]: [['주문 조회 쿼리 인덱스 재설계', '실행계획을 분석해 복합 인덱스를 설계하고 전후 응답시간을 비교했습니다.', 280000]],
  [D.TAX_STRUCTURE_FACTCHECK]: [['개인사업자 경비 처리 팩트체크', '경비 처리 방식이 맞는지 확인하고 보완점을 정리했습니다.', 150000]],
  [D.STARTUP_CONTRACT_REVIEW]: [['용역 계약서 손해배상 조항 검토', '손해배상 한도와 해지 조항을 검토하고 수정 의견을 정리했습니다.', 300000]],
  [D.FIRE_SAFETY_INSPECTION]: [['소규모 사무실 소방시설 점검', '소화기와 감지기, 비상구 상태를 점검해 보완 목록을 정리했습니다.', 180000]],
};
const HISTORY_EXPERTS = 18; // 앞에서부터 18명에게 완료 이력을 준다

// 의뢰인 평가(1.0~10.0, 0.5 단위)와 짧은 후기 — 거래마다 조금씩 다르게
const REVIEWS: [number, string][] = [
  [10, '설명이 친절하고 보고서가 꼼꼼했어요.'], [9.5, '약속한 일정보다 빨리 끝내 주셨어요.'],
  [9, '현장에서 놓칠 뻔한 부분을 잡아 주셔서 큰 도움이 됐어요.'], [8.5, '결과 보고서가 이해하기 쉬웠어요.'],
  [9.5, '질문에 빠르게 답해 주셨어요.'], [8, '가격 대비 만족스러웠어요.'],
  [9, '보완 요청에도 바로 대응해 주셨어요.'], [7.5, '일정은 조금 늦었지만 결과는 정확했어요.'],
];
const rateOf = (k: number) => REVIEWS[k % REVIEWS.length];

// 분쟁을 거친 거래: 정산(보완 후 승인) / 환불(실패) / 보류(분쟁 진행 중) — 거래 사례가 성공만으로 보이지 않게
// [분야, 제목, 금액, 결과, 이의제기 사유, 관리자 판단, 몇 달 전]
type Dz = [DomainType, string, number, 'SETTLE' | 'REFUND' | 'HOLD', string, string, number];
export const DISPUTED: Dz[] = [
  [D.VEHICLE_DIAGNOSTICS, '중고 세단 하부 부식 점검 보고서', 160000, 'SETTLE', '보고서에 하부 사진이 빠져 있어 부식 정도를 확인할 수 없습니다.', '전문가가 하부 사진과 보완 설명을 추가로 제출해 요청 범위를 채운 것으로 판단해 정산합니다.', 5],
  [D.REAL_ESTATE_TITLE_ANALYSIS, '다세대 주택 전세 권리분석', 210000, 'SETTLE', '선순위 보증금 계산이 실제 세대 수와 다릅니다.', '전입세대 열람 결과를 반영한 수정본을 냈고 결론이 같아 정산합니다.', 4],
  [D.BUILDING_DEFECT_INSPECTION, '욕실 누수 원인 진단', 180000, 'SETTLE', '누수 위치를 추정한 근거가 부족합니다.', '열화상 사진과 근거를 보완해 제출했으므로 정산합니다.', 3],
  [D.DEV_CODE_REVIEW, '회원 탈퇴 로직 코드 리뷰', 240000, 'SETTLE', '요청한 개인정보 삭제 범위 검토가 빠졌습니다.', '빠진 항목을 추가로 리뷰해 제출했으므로 정산합니다.', 1],
  [D.VEHICLE_DIAGNOSTICS, '수입차 성능 점검 현장 동행', 190000, 'REFUND', '약속한 날짜에 현장에 오지 않았습니다.', '현장에 가지 않은 것이 확인되어 의뢰인에게 전액 환불합니다.', 4],
  [D.TAX_STRUCTURE_FACTCHECK, '주택 양도세 계산 팩트체크', 150000, 'REFUND', '계산에 쓴 공제 기준이 개정 전 기준입니다.', '개정 전 기준을 적용한 것이 확인되어 환불합니다.', 2],
  [D.FIRE_SAFETY_INSPECTION, '상가 소방시설 점검', 170000, 'REFUND', '점검표만 있고 실제 점검 사진이 없습니다.', '현장 점검 근거가 없어 환불합니다.', 1],
  [D.REAL_ESTATE_TITLE_ANALYSIS, '오피스텔 경매 물건 임장 보고서', 260000, 'HOLD', '점유자 확인 내용이 현장 상황과 다릅니다.', '', 0],
  [D.BACKEND_DB_TUNING, '검색 API 응답 지연 개선', 300000, 'HOLD', '개선 후에도 응답 시간이 요청한 기준(1초 이내)을 넘습니다.', '', 0],
];

const pad = (n: number) => String(n).padStart(2, '0');
const rand = () => crypto.randomBytes(24).toString('hex');

async function bootstrap() {
  if (process.env.SEED_LIVE_CONFIRM !== 'YES') {
    console.error('SEED_LIVE_CONFIRM=YES 가 없어서 멈춥니다. (실수로 실행되지 않게 막는 장치)');
    process.exit(1);
  }
  if (EXPERTS.length !== 50 || PROJECTS.length !== 30) throw new Error('데이터 개수 확인 필요');

  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  try {
    const ds = app.get(DataSource);
    const users = ds.getRepository(User);
    const certs = ds.getRepository(Certification);
    const bountyRepo = ds.getRepository(Bounty);
    const bounties = app.get(BountiesService);
    const opts = ds.options as { url?: string };
    console.log('대상 DB 호스트:', opts.url ? new URL(opts.url).hostname : '(개별 DB_* 변수)');

    const ensureUser = async (email: string, name: string, role: UserRole) => {
      const found = await users.findOne({ where: { email } });
      if (found) return { user: found, created: false };
      const user = await users.save(users.create({
        email, name, role,
        passwordHash: await bcrypt.hash(rand(), 8),
        ciHash: crypto.createHash('sha256').update(`${email}::${rand()}`).digest('hex'),
        emailVerifiedAt: new Date(),
      }));
      return { user, created: true };
    };
    const setRegion = (key: string) => {
      const [sido, sigungu, dong, lat, lng] = P[key];
      return { regionSido: sido, regionSigungu: sigungu, regionDong: dong, regionLat: lat, regionLng: lng };
    };

    // 1) 의뢰인 6명
    const clients: User[] = [];
    for (const [email, name] of CLIENTS) clients.push((await ensureUser(email, name, UserRole.CLIENT)).user);

    // 2) 전문가 50명: 인증 승인 + 활동 지역
    let newExperts = 0;
    let histories = 0;
    for (let i = 0; i < EXPERTS.length; i++) {
      const [name, domain, place] = EXPERTS[i];
      const email = `mock-expert${pad(i + 1)}@demo.com`;
      const { user, created } = await ensureUser(email, name, UserRole.EXPERT);
      if (!user.regionSido) await users.update({ id: user.id }, setRegion(place));
      const hasCert = await certs.count({ where: { userId: user.id, domainType: domain, verifiedStatus: VerificationStatus.APPROVED } });
      if (!hasCert) {
        await certs.save(certs.create({
          userId: user.id, domainType: domain, track: VerificationTrack.STANDARD,
          licenseNumber: `MOCK-LICENSE-${pad(i + 1)}-${domain.slice(0, 4)}`,
          verifiedStatus: VerificationStatus.APPROVED,
          reviewNote: '[시연 데이터] 자격 인증 승인',
        }));
      }
      if (!created) continue;
      newExperts++;
      // 완료 이력: 실제 서비스 흐름(지원→선택→결제→제출→승인)을 그대로 탄다
      if (i < HISTORY_EXPERTS) {
        const list = (HISTORY[domain] ?? []).slice(0, i % 2 === 0 ? 2 : 1);
        const client = clients[i % clients.length];
        for (const [title, desc, amount] of list) {
          try {
            const b = await bounties.create(client.id, { domainType: domain, title: `${title} (${P[place][2]})`, description: desc, bountyAmount: amount } as any);
            const ap = await bounties.apply(b.id, user.id, { message: `${title} 경험이 있습니다.` });
            await bounties.selectApplicant(b.id, ap.id, client.id);
            await bounties.confirmPayment(b.id, client.id);
            await bounties.submitResult(b.id, user.id, '/uploads/mock-result-match-demo.pdf', `${title} 작업을 마치고 결과 보고서를 첨부합니다.`);
            await bounties.approve(b.id, client.id);
            if ((i + histories) % 5 !== 4) {
              const [rating, note] = rateOf(i + histories);
              await bounties.rate(b.id, client.id, { rating, note } as any);
            }
            // 처리 기간을 사람마다 다르게(2~25일) 두고 지난 6개월에 흩어 놓는다 → 평판 점수가 사람마다 갈린다
            const end = new Date(Date.now() - (((i * 37 + histories * 11) % 170) + 5) * 86_400_000);
            const start = new Date(end.getTime() - (2 + ((i * 7 + histories * 3) % 24)) * 86_400_000);
            await ds.query('UPDATE bounties SET "updatedAt" = $1, "createdAt" = $2 WHERE id = $3', [end, start, b.id]);
            histories++;
          } catch (e) {
            console.warn(`  완료 이력 건너뜀(${email}): ${(e as Error).message}`);
          }
        }
      }
      console.log(`전문가 ${pad(i + 1)}: ${name} · ${domain} · ${P[place].slice(0, 3).join(' ')}`);
    }

    // 3) 기존 시연 전문가 지역 채우기
    let filled = 0;
    for (const [email, place] of Object.entries(EXISTING)) {
      const u = await users.findOne({ where: { email } });
      if (u && !u.regionSido) { await users.update({ id: u.id }, setRegion(place)); filled++; }
    }

    // 4) 모집 중 프로젝트 30개 (만남 지역 포함)
    let newProjects = 0;
    for (let k = 0; k < PROJECTS.length; k++) {
      const [domain, title, description, amount, place, meet] = PROJECTS[k];
      const client = clients[k % clients.length];
      if (await bountyRepo.count({ where: { clientId: client.id, title } })) continue;
      const b = (await bountyRepo.save(bountyRepo.create({
        clientId: client.id, domainType: domain, title, description, bountyAmount: amount,
        status: BountyStatus.PENDING,
        serviceType: meet ? ServiceType.COMPANION : ServiceType.REMOTE,
        companionLocation: meet ?? null,
        companionMeetingAt: meet ? new Date(Date.now() + (4 + (k % 9)) * 86_400_000) : null,
        ...setRegion(place),
      } as any) as any)) as Bounty;
      newProjects++;
      console.log(`프로젝트 ${pad(k + 1)}: ${b.title}`);
    }

    // 5) 데모 둘러보기 계정(client@demo.com, expert@demo.com)의 최근 6개월 거래 이력
    //    AI 인사이트의 분야별 분포·월별 추이가 한 달·한 분야로만 보이지 않게, 달마다 건수와 분야를 다르게 넣는다.
    const demoHistory = await seedDemoHistory(ds, users, certs, bountyRepo, bounties, clients);

    // 5-2) 분쟁을 거친 거래 (정산 4 · 환불 3 · 보류 2)
    const disputes = app.get(DisputesService);
    const now0 = new Date();
    let disputed = 0;
    for (let k = 0; k < DISPUTED.length; k++) {
      const [domain, title, amount, result, reason, note, ago] = DISPUTED[k];
      const client = clients[(k + 2) % clients.length];
      if (await bountyRepo.count({ where: { clientId: client.id, title } })) continue;
      const pool = EXPERTS.map((e, idx) => [e, idx] as const).filter(([e]) => e[1] === domain);
      const pick = pool[(k + 1) % pool.length];
      const expert = (await users.findOne({ where: { email: `mock-expert${pad(pick[1] + 1)}@demo.com` } })) as User | null;
      if (!expert) continue;
      try {
        const b = await bounties.create(client.id, { domainType: domain, title, description: `${title}을 요청합니다. 확인한 내용을 근거와 함께 보고서로 정리해 주세요.`, bountyAmount: amount } as any);
        const ap = await bounties.apply(b.id, expert.id, { message: '같은 분야 경험이 있습니다. 진행하겠습니다.' });
        await bounties.selectApplicant(b.id, ap.id, client.id);
        await bounties.confirmPayment(b.id, client.id);
        await bounties.submitResult(b.id, expert.id, '/uploads/mock-result-report.pdf', `${title} 결과 보고서를 제출합니다.`);
        const dz = await disputes.file(b.id, client.id, { reason });
        if (result !== 'HOLD') await disputes.resolve(dz.id, note, result === 'REFUND');
        const end = result === 'HOLD'
          ? new Date(Date.now() - (2 + k) * 86_400_000)
          : new Date(now0.getFullYear(), now0.getMonth() - ago, 6 + k * 3, 15, 0, 0);
        const start = new Date(end.getTime() - (6 + (k % 4) * 3) * 86_400_000);
        await ds.query('UPDATE bounties SET "updatedAt" = $1, "createdAt" = $2 WHERE id = $3', [end, start, b.id]);
        disputed++;
      } catch (e) {
        console.warn(`  분쟁 거래 건너뜀: ${title} - ${(e as Error).message}`);
      }
    }
    console.log(`분쟁을 거친 거래 ${disputed}건 추가`);

    // 6) 예전 시연 거래 다듬기: 등록과 정산이 같은 날(처리 기간 0일)이고 평가가 비어 있던 시연 거래에
    //    처리 기간(2~19일)·지난 6개월 날짜·의뢰인 평가를 나눠 준다. @demo.com 의뢰인의 거래만 건드린다.
    const old = await ds.query(
      `SELECT b.id FROM bounties b JOIN users u ON u.id = b.client_id
        WHERE b.status = 'SETTLED' AND u.email LIKE '%@demo.com'
          AND b."updatedAt" - b."createdAt" < interval '1 day' ORDER BY b."createdAt"`,
    );
    let tidied = 0;
    for (let k = 0; k < old.length; k++) {
      const end = new Date(Date.now() - (((k * 13) % 170) + 3) * 86_400_000);
      const start = new Date(end.getTime() - (2 + ((k * 5) % 18)) * 86_400_000);
      await ds.query('UPDATE bounties SET "updatedAt" = $1, "createdAt" = $2 WHERE id = $3', [end, start, old[k].id]);
      tidied++;
    }
    const unrated = await ds.query(
      `SELECT b.id FROM bounties b JOIN users u ON u.id = b.client_id
        WHERE b.status = 'SETTLED' AND u.email LIKE '%@demo.com' AND b."clientRating" IS NULL
          AND NOT EXISTS (SELECT 1 FROM disputes d WHERE d.bounty_id = b.id) ORDER BY b."createdAt"`,
    );
    let rated = 0;
    for (let k = 0; k < unrated.length; k++) {
      if ('012'.includes(String(unrated[k].id).slice(-1))) continue; // 일부(약 2할)는 평가 전으로 남겨 둔다 — id로 정해서 다시 돌려도 같다
      const [rating, note] = rateOf(k + 3);
      await ds.query('UPDATE bounties SET "clientRating" = $1, "clientRatingNote" = $2 WHERE id = $3', [rating.toFixed(1), note, unrated[k].id]);
      rated++;
    }
    // 7) 가입일·인증일: 시연 계정이 모두 "오늘 가입"으로 보이지 않게 지난 6~20개월 사이로 나눈다 (오늘 만든 계정만)
    const fresh = await ds.query(
      `SELECT id FROM users WHERE (email LIKE 'mock-expert%@demo.com' OR email LIKE 'mock-client%@demo.com')
          AND "createdAt" > now() - interval '2 days' ORDER BY email`,
    );
    for (let k = 0; k < fresh.length; k++) {
      const joined = new Date(Date.now() - (180 + ((k * 23) % 420)) * 86_400_000);
      await ds.query('UPDATE users SET "createdAt" = $1, "emailVerifiedAt" = $2 WHERE id = $3', [joined, joined, fresh[k].id]);
      await ds.query('UPDATE certifications SET "createdAt" = $1 WHERE user_id = $2', [new Date(joined.getTime() + 9 * 86_400_000), fresh[k].id]);
    }
    console.log(`예전 시연 거래 처리 기간 ${tidied}건, 의뢰인 평가 ${rated}건 채움`);

    const expertsWithRegion = await users.createQueryBuilder('u').where('u.region_sido IS NOT NULL').andWhere('u.role = :r', { r: UserRole.EXPERT }).getCount();
    const openWithRegion = await bountyRepo.createQueryBuilder('b').where('b.region_sido IS NOT NULL').andWhere('b.status = :s', { s: BountyStatus.PENDING }).getCount();
    console.log(`\nDONE 새 전문가 ${newExperts}명(완료 이력 ${histories}건), 기존 전문가 지역 ${filled}명, 새 프로젝트 ${newProjects}개`);
    console.log(`데모 의뢰인 모집 중 프로젝트 ${demoHistory.open}개, 데모 의뢰인 이력 ${demoHistory.client}건, 데모 전문가 이력 ${demoHistory.expert}건, 진행 단계별 프로젝트 ${demoHistory.flows}개 추가`);
    console.log(`지금 지역이 있는 전문가 ${expertsWithRegion}명, 지역이 있는 모집 중 프로젝트 ${openWithRegion}개`);
  } finally {
    await app.close();
  }
}

// [몇 달 전(0=이번 달), 날짜, 분야, 제목, 금액]
type H = [number, number, DomainType, string, number];
// 데모 의뢰인: 6개월 15건, 8개 분야 — 달마다 1~4건
export const CLIENT_HISTORY: H[] = [
  [5, 6, D.REAL_ESTATE_TITLE_ANALYSIS, '전세 계약 전 등기부 권리분석', 180000],
  [5, 21, D.DEV_CODE_REVIEW, '회원가입 모듈 보안 코드 리뷰', 260000],
  [4, 3, D.VEHICLE_DIAGNOSTICS, '중고 SUV 구매 전 동행 점검', 150000],
  [4, 14, D.TAX_STRUCTURE_FACTCHECK, '개인사업자 부가세 신고 구조 점검', 120000],
  [4, 26, D.BACKEND_DB_TUNING, '정산 배치 쿼리 성능 점검', 310000],
  [3, 18, D.BUILDING_DEFECT_INSPECTION, '사무실 이전 전 누수·균열 점검', 220000],
  [2, 2, D.STARTUP_CONTRACT_REVIEW, '외주 개발 용역 계약서 검토', 350000],
  [2, 9, D.REAL_ESTATE_TITLE_ANALYSIS, '창고 임차 전 권리분석', 200000],
  [2, 17, D.DEV_CODE_REVIEW, '결제 API 연동 코드 리뷰', 280000],
  [2, 25, D.FIRE_SAFETY_INSPECTION, '매장 소방시설 정기 점검', 160000],
  [1, 8, D.VEHICLE_DIAGNOSTICS, '법인 차량 정밀 진단', 190000],
  [1, 22, D.BACKEND_DB_TUNING, '주문 조회 인덱스 재설계', 340000],
  [0, 3, D.REAL_ESTATE_TITLE_ANALYSIS, '신규 매장 상가 임차 권리분석', 240000],
  [0, 7, D.BUILDING_DEFECT_INSPECTION, '매장 인테리어 전 하자 점검', 210000],
  [0, 10, D.DEV_CODE_REVIEW, '관리자 페이지 권한 검증 리뷰', 230000],
];
// 데모 전문가: 6개월 12건, 3개 분야 — 달마다 1~3건
export const EXPERT_HISTORY: H[] = [
  [5, 12, D.DEV_CODE_REVIEW, '쇼핑몰 장바구니 로직 코드 리뷰', 220000],
  [4, 5, D.DEV_CODE_REVIEW, '사내 API 예외 처리 리뷰', 180000],
  [4, 23, D.BACKEND_DB_TUNING, '게시판 검색 쿼리 튜닝', 260000],
  [3, 7, D.MOBILE_QA_AUTOMATION, '앱 출시 전 회귀 테스트 자동화', 300000],
  [3, 19, D.DEV_CODE_REVIEW, '로그인 세션 처리 보안 리뷰', 240000],
  [3, 28, D.BACKEND_DB_TUNING, '통계 집계 쿼리 최적화', 280000],
  [2, 11, D.MOBILE_QA_AUTOMATION, '안드로이드 기기별 화면 QA', 200000],
  [2, 24, D.DEV_CODE_REVIEW, '리액트 렌더링 성능 리뷰', 230000],
  [1, 6, D.DEV_CODE_REVIEW, '파일 업로드 검증 로직 리뷰', 210000],
  [1, 16, D.BACKEND_DB_TUNING, '예약 테이블 인덱스 개선', 320000],
  [1, 27, D.MOBILE_QA_AUTOMATION, 'iOS 결제 흐름 테스트', 250000],
  [0, 8, D.DEV_CODE_REVIEW, '관리자 대시보드 코드 리뷰', 260000],
];

// 데모 의뢰인의 모집 중 프로젝트 (AI 매칭에서 고를 거리가 4개뿐이던 것을 12개 안팎으로)
export const DEMO_CLIENT_OPEN: [DomainType, string, string, number, string, string?][] = [
  [D.REAL_ESTATE_TITLE_ANALYSIS, '마포 공덕동 오피스텔 월세 계약 전 권리 확인', '월세 계약 전 등기부 근저당과 임대인 체납 여부를 확인하고 계약 위험을 정리해 주세요.', 150000, '공덕'],
  [D.VEHICLE_DIAGNOSTICS, '법인 업무용 중고 승합차 구매 전 동행 점검', '업무용으로 살 중고 승합차의 사고 이력과 하부 부식, 엔진 상태를 현장에서 함께 봐 주세요.', 170000, '장안', '서울 동대문구 장안평 중고차 매매단지 입구'],
  [D.BUILDING_DEFECT_INSPECTION, '새 사무실 입주 전 누수·결로 점검', '입주 예정 사무실의 누수 흔적과 결로 위험, 창호 상태를 점검해 하자 목록을 정리해 주세요.', 200000, '성수', '서울 성동구 성수동 사무실 건물 1층'],
  [D.FIRE_SAFETY_INSPECTION, '새 매장 오픈 전 소방시설 점검', '오픈 예정 매장의 소화기, 감지기, 비상구 표시가 기준에 맞는지 점검해 주세요.', 160000, '서교', '서울 마포구 서교동 매장 앞'],
  [D.TAX_STRUCTURE_FACTCHECK, '법인 전환 시 절세 효과 팩트체크', '개인사업자에서 법인으로 바꾸면 세금이 실제로 줄어드는지 숫자로 확인해 주세요.', 220000, '여의도'],
  [D.STARTUP_CONTRACT_REVIEW, '외주 디자인 용역 계약서 검토', '디자인 외주 계약서의 저작권 귀속과 손해배상 조항이 불리하지 않은지 검토해 주세요.', 250000, '서초'],
  [D.MOBILE_QA_AUTOMATION, '예약 앱 출시 전 기기별 회귀 테스트', '안드로이드와 iOS 주요 기기에서 예약·결제 흐름을 테스트하고 오류 목록을 정리해 주세요.', 280000, '구로'],
  [D.REAL_ESTATE_TITLE_ANALYSIS, '분당 정자동 상가 임차 전 임장 대행', '임차 예정 상가의 유동 인구와 건물 관리 상태, 권리 관계를 현장에서 확인해 주세요.', 260000, '정자', '경기 성남시 분당구 정자동 상가 건물 앞'],
];

const FLOW_DESC: Record<string, string> = {
  '새 사무실 바닥 들뜸·균열 원인 진단': '이사 온 사무실 바닥 타일이 들뜨고 벽에 실금이 보입니다. 구조 문제인지 시공 문제인지 진단하고 보수 범위와 예상 비용을 정리해 주세요.',
  '법인 차량 2대 정기 정밀 진단': '업무용 승합차와 세단 2대의 엔진, 변속기, 하부 상태를 정밀 진단하고 교체가 필요한 소모품 목록을 정리해 주세요.',
  '모바일 웹 로그인 흐름 보안 리뷰': '모바일 웹의 로그인, 자동 로그인, 비밀번호 재설정 코드를 점검해 세션 탈취나 무차별 대입에 약한 부분과 개선안을 정리해 주세요.',
  '사내 메신저 웹소켓 코드 리뷰': '사내 메신저의 웹소켓 연결·재연결 처리와 메시지 권한 검증 코드를 리뷰해 끊김과 보안 문제를 찾아 주세요.',
  '배송 조회 쿼리 성능 개선': '배송 조회 화면이 주문이 늘면서 5초 가까이 걸립니다. 실행계획을 분석해 인덱스와 쿼리 개선안, 전후 비교표를 주세요.',
  '쇼핑 앱 결제 화면 회귀 테스트': '결제 화면 개편 후 안드로이드·iOS 주요 기기에서 결제, 취소, 쿠폰 적용 흐름을 테스트하고 오류 목록을 정리해 주세요.',
};

async function seedDemoHistory(
  ds: DataSource,
  users: ReturnType<DataSource['getRepository']>,
  certs: ReturnType<DataSource['getRepository']>,
  bountyRepo: ReturnType<DataSource['getRepository']>,
  bounties: BountiesService,
  mockClients: User[],
) {
  const out = { client: 0, expert: 0, open: 0, flows: 0 };
  const demoClient = (await users.findOne({ where: { email: 'client@demo.com' } })) as User | null;
  const demoExpert = (await users.findOne({ where: { email: 'expert@demo.com' } })) as User | null;
  const now = new Date();
  const when = (monthsAgo: number, day: number) => new Date(now.getFullYear(), now.getMonth() - monthsAgo, day, 14, 0, 0);
  const ensureCert = async (userId: string, domain: DomainType, license: string) => {
    if (await certs.count({ where: { userId, domainType: domain, verifiedStatus: VerificationStatus.APPROVED } })) return;
    await certs.save(certs.create({ userId, domainType: domain, track: VerificationTrack.STANDARD, licenseNumber: license, verifiedStatus: VerificationStatus.APPROVED, reviewNote: '[시연 데이터] 자격 인증 승인' }));
  };
  const run = async (clientId: string, expertId: string, [ago, day, domain, title, amount]: H) => {
    if (await bountyRepo.count({ where: { clientId, title } })) return false;
    const b = await bounties.create(clientId, { domainType: domain, title, description: `${title} 요청입니다. 결과를 보고서로 정리해 주세요.`, bountyAmount: amount } as any);
    const ap = await bounties.apply(b.id, expertId, { message: '같은 분야 경험이 있습니다. 진행하겠습니다.' });
    await bounties.selectApplicant(b.id, ap.id, clientId);
    await bounties.confirmPayment(b.id, clientId);
    await bounties.submitResult(b.id, expertId, '/uploads/mock-result-report.pdf', `${title} 작업을 마치고 결과 보고서를 첨부합니다.`);
    await bounties.approve(b.id, clientId);
    if ((ago + day) % 6 !== 0) {
      const [rating, note] = rateOf(ago * 3 + day);
      await bounties.rate(b.id, clientId, { rating, note } as any);
    }
    const t = when(ago, day);
    await ds.query('UPDATE bounties SET "updatedAt" = $1, "createdAt" = $2 WHERE id = $3', [t, new Date(t.getTime() - (3 + ((ago * 7 + day) % 15)) * 86_400_000), b.id]);
    return true;
  };

  if (demoClient) {
    for (let k = 0; k < DEMO_CLIENT_OPEN.length; k++) {
      const [domain, title, description, amount, place, meet] = DEMO_CLIENT_OPEN[k];
      if (await bountyRepo.count({ where: { clientId: demoClient.id, title } })) continue;
      const [sido, sigungu, dong, lat, lng] = P[place];
      await bountyRepo.save(bountyRepo.create({
        clientId: demoClient.id, domainType: domain, title, description, bountyAmount: amount, status: BountyStatus.PENDING,
        serviceType: meet ? ServiceType.COMPANION : ServiceType.REMOTE, companionLocation: meet ?? null,
        companionMeetingAt: meet ? new Date(Date.now() + (5 + k) * 86_400_000) : null,
        regionSido: sido, regionSigungu: sigungu, regionDong: dong, regionLat: lat, regionLng: lng,
      } as any) as any);
      out.open++;
    }
    if ((demoClient as any).monthlyBudgetGoal == null) await users.update({ id: demoClient.id }, { monthlyBudgetGoal: 1_500_000 } as any);
    for (const h of CLIENT_HISTORY) {
      const idx = EXPERTS.findIndex(([, d]) => d === h[2]);
      const expert = (await users.findOne({ where: { email: `mock-expert${pad(idx + 1)}@demo.com` } })) as User | null;
      if (!expert) continue;
      try { if (await run(demoClient.id, expert.id, h)) out.client++; } catch (e) { console.warn(`  데모 의뢰인 이력 건너뜀: ${h[3]} - ${(e as Error).message}`); }
    }
  }
  // 진행 단계가 다양한 프로젝트: 지원자 모집 중(지원자 있음) / 진행 중(결제 완료) / 결과 제출(승인 대기)
  const flow = async (clientId: string, expertIds: string[], domain: DomainType, title: string, amount: number, place: string, stage: 'APPLIED' | 'LOCKED' | 'SUBMITTED') => {
    if (await bountyRepo.count({ where: { clientId, title } })) return false;
    const b = await bounties.create(clientId, { domainType: domain, title, description: FLOW_DESC[title] ?? `${title} 요청입니다. 결과를 보고서로 정리해 주세요.`, bountyAmount: amount } as any);
    const [sido, sigungu, dong, lat, lng] = P[place];
    await bountyRepo.update({ id: b.id }, { regionSido: sido, regionSigungu: sigungu, regionDong: dong, regionLat: lat, regionLng: lng } as any);
    const apps: { id: string }[] = [];
    for (const id of expertIds) apps.push(await bounties.apply(b.id, id, { message: '같은 분야에서 여러 번 진행해 봤습니다. 일정 맞춰 진행하겠습니다.' }));
    if (stage === 'APPLIED') return true;
    await bounties.selectApplicant(b.id, apps[0].id, clientId);
    await bounties.confirmPayment(b.id, clientId);
    if (stage === 'SUBMITTED') await bounties.submitResult(b.id, expertIds[0], '/uploads/mock-result-report.pdf', `${title} 결과 보고서를 제출합니다. 확인 부탁드립니다.`);
    return true;
  };
  const mockOf = async (domain: DomainType, n: number) => {
    const out: string[] = [];
    for (let i = 0; i < EXPERTS.length && out.length < n; i++) {
      if (EXPERTS[i][1] !== domain) continue;
      const u = (await users.findOne({ where: { email: `mock-expert${pad(i + 1)}@demo.com` } })) as User | null;
      if (u) out.push(u.id);
    }
    return out;
  };
  if (demoClient) {
    if (!(demoClient as any).regionSido) {
      const [sido, sigungu, dong, lat, lng] = P['성수'];
      await users.update({ id: demoClient.id }, { regionSido: sido, regionSigungu: sigungu, regionDong: dong, regionLat: lat, regionLng: lng } as any);
    }
    const steps: [DomainType, string, number, string, 'APPLIED' | 'LOCKED' | 'SUBMITTED', number][] = [
      [D.BUILDING_DEFECT_INSPECTION, '새 사무실 바닥 들뜸·균열 원인 진단', 230000, '성수', 'APPLIED', 3],
      [D.VEHICLE_DIAGNOSTICS, '법인 차량 2대 정기 정밀 진단', 260000, '장안', 'LOCKED', 2],
      [D.DEV_CODE_REVIEW, '모바일 웹 로그인 흐름 보안 리뷰', 270000, '서교', 'SUBMITTED', 2],
    ];
    for (const [domain, title, amount, place, stage, n] of steps) {
      try { if (await flow(demoClient.id, await mockOf(domain, n), domain, title, amount, place, stage)) out.flows++; } catch (e) { console.warn(`  데모 의뢰인 진행 건 건너뜀: ${title} - ${(e as Error).message}`); }
    }
  }

  if (demoExpert) {
    for (const d of [D.DEV_CODE_REVIEW, D.BACKEND_DB_TUNING, D.MOBILE_QA_AUTOMATION]) await ensureCert(demoExpert.id, d, `DEMO-LICENSE-${d.slice(0, 6)}`);
    for (let i = 0; i < EXPERT_HISTORY.length; i++) {
      const client = mockClients[i % mockClients.length];
      try { if (await run(client.id, demoExpert.id, EXPERT_HISTORY[i])) out.expert++; } catch (e) { console.warn(`  데모 전문가 이력 건너뜀: ${EXPERT_HISTORY[i][3]} - ${(e as Error).message}`); }
    }
    const steps: [DomainType, string, number, string, 'APPLIED' | 'LOCKED' | 'SUBMITTED'][] = [
      [D.DEV_CODE_REVIEW, '사내 메신저 웹소켓 코드 리뷰', 250000, '구로', 'APPLIED'],
      [D.BACKEND_DB_TUNING, '배송 조회 쿼리 성능 개선', 290000, '마곡', 'LOCKED'],
      [D.MOBILE_QA_AUTOMATION, '쇼핑 앱 결제 화면 회귀 테스트', 240000, '대치', 'SUBMITTED'],
    ];
    for (let k = 0; k < steps.length; k++) {
      const [domain, title, amount, place, stage] = steps[k];
      const others = stage === 'APPLIED' ? await mockOf(domain, 2) : [];
      try { if (await flow(mockClients[k % mockClients.length].id, [demoExpert.id, ...others], domain, title, amount, place, stage)) out.flows++; } catch (e) { console.warn(`  데모 전문가 진행 건 건너뜀: ${title} - ${(e as Error).message}`); }
    }
  }
  return out;
}

if (require.main === module) {
  bootstrap().catch((err) => {
    console.error('목데이터 생성 실패:', err);
    process.exit(1);
  });
}
