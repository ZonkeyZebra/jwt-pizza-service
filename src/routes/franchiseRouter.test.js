const request = require('supertest');
const app = require('../service');

// const regularUser = { name: 'pizza please', email: 'email@test.com', password: 'b' };

let adminAuthToken;

const { Role, DB } = require('../database/database.js');

function randomName() {
    return Math.random().toString(36).substring(2, 12);
}

async function createAdminUser() {
    let user = { password: 'toomanysecrets', roles: [{ role: Role.Admin }] };
    user.name = randomName();
    user.email = user.name + '@adminTest.com';

    user = await DB.addUser(user);
    return { ...user, password: 'toomanysecrets' };
}

beforeAll(async () => {
    // make email unique per test run
    const testAdmin = createAdminUser();
    const admin = await testAdmin

    // login admin user
    const loginRes = await request(app).put('/api/auth').send(admin);
    adminAuthToken = loginRes.body.token;

    // create a franchise to use in tests
    const franchiseRes = await request(app)
        .post('/api/franchise')
        .set('Authorization', `Bearer ${adminAuthToken}`)
        .send({
            name: randomName(),
            admins: [{ email: admin.email }],
        });
    // expect(franchiseRes.status).toBe(200);
    console.log(franchiseRes.body);
});

test('get franchises', async () => {
  const franchiseList = await request(app).get('/api/franchise?page=0&limit=10&name=*');
  expect(franchiseList.status).toBe(200);
  console.log(franchiseList.body.id);
});