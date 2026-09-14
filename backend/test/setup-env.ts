import * as dotenv from 'dotenv';
import * as path from 'path';

/**
 * jest-e2e.json의 setupFiles에서 (각 e2e 테스트 파일이 실행되기 전에, AppModule을
 * import하기도 전에) 가장 먼저 실행된다. .env.test의 값들을 process.env에 채워서,
 * AppModule의 TypeOrmModule.forRootAsync가 실제 개발 DB(.env)가 아니라
 * 테스트 전용 DB(credobounty_test)를 보도록 만든다.
 */
dotenv.config({ path: path.resolve(__dirname, '../.env.test') });
