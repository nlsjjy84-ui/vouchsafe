import { CreateDateColumn, Entity, PrimaryGeneratedColumn, Column, Unique } from 'typeorm';

@Entity('community_likes')
@Unique(['postId', 'userId'])
export class CommunityLike {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'post_id' })
  postId: string;

  @Column({ name: 'user_id' })
  userId: string;

  @CreateDateColumn()
  createdAt: Date;
}
